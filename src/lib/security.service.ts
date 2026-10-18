import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupportVault } from "./support.secrets";
import type { LaborDependencies } from "./labor.dependencies";
export type SecurityState = {
  enabled: boolean;
  counter: number;
  recoveryHashes: string[];
  pendingAt?: string;
};
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function base32(bytes: Buffer) {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
export function totp(secret: string, at = Date.now(), digits = 6) {
  let bits = 0,
    value = 0;
  const bytes: number[] = [];
  for (const c of secret.replace(/=+$/, "").toUpperCase()) {
    const i = alphabet.indexOf(c);
    if (i < 0) throw new Error("Segredo TOTP inválido.");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, "0");
}
function validCounter(secret: string, code: string, previous: number) {
  if (!/^\d{6}$/.test(code)) return -1;
  const now = Math.floor(Date.now() / 30000);
  for (const counter of [now, now - 1, now + 1])
    if (
      counter > previous &&
      timingSafeEqual(Buffer.from(totp(secret, counter * 30000)), Buffer.from(code))
    )
      return counter;
  return -1;
}
export function createSecurityService(
  deps: Omit<LaborDependencies, "requireSensitive">,
  verifyPassword: (password: string) => Promise<void>,
) {
  const vault = createSupportVault(deps.directory, "mfa");
  const pending = createSupportVault(deps.directory, "mfa-pending");
  const grants = new Map<string, number>();
  const attempts = new Map<string, { count: number; until: number }>();
  function requireSensitive(token?: string) {
    deps.requireAdmin(token);
    if (!token || (grants.get(hash(token)) || 0) <= Date.now())
      throw new Error(
        "Confirme o código MFA em Segurança para liberar ações sensíveis por 5 minutos.",
      );
  }
  return {
    requireSensitive,
    async loginRequired() {
      return (await deps.read()).security?.enabled === true;
    },
    async verifyLoginCode(code: string | undefined, client: string) {
      const key = `login:${client}`;
      const failed = attempts.get(key);
      if (failed && failed.until > Date.now() && failed.count >= 5)
        throw new Error("Muitas tentativas MFA. Aguarde 15 minutos.");
      if (!(await this.loginRequired())) return;
      attempts.set(key, {
        count: failed && failed.until > Date.now() ? failed.count + 1 : 1,
        until: Date.now() + 900000,
      });
      if (!code) throw new Error("Informe o código do autenticador ou um código de recuperação.");
      // Recovery codes are stored as hashes in the database and can be
      // validated without opening the TOTP secret vault. Besides being less
      // work, this keeps emergency recovery available if the local vault is
      // temporarily unavailable.
      const recoveryCandidate = (await deps.read()).security?.recoveryHashes.includes(hash(code)) === true;
      const secret = recoveryCandidate ? "" : await vault.get();
      const accepted = await deps.mutate((db) => {
        const state = db.security;
        if (!state?.enabled) return false;
        const recovery = state.recoveryHashes.includes(hash(code));
        const counter = secret ? validCounter(secret, code, state.counter) : -1;
        if (!recovery && counter < 0) return false;
        if (recovery) state.recoveryHashes = state.recoveryHashes.filter((value) => value !== hash(code));
        else state.counter = counter;
        deps.audit(db, "seguranca.mfa.login", deps.storeId, recovery ? "Código de recuperação usado" : "Autenticador validado");
        return true;
      });
      if (!accepted) throw new Error("Código inválido, expirado ou já utilizado.");
      attempts.delete(key);
    },
    async status(token?: string) {
      deps.requireAdmin(token);
      const db = await deps.read();
      return {
        enabled: db.security?.enabled || false,
        verifiedUntil: token ? grants.get(hash(token)) || 0 : 0,
        recoveryRemaining: db.security?.recoveryHashes.length || 0,
      };
    },
    async begin(token: string | undefined, password: string) {
      deps.requireAdmin(token);
      await verifyPassword(password);
      if ((await deps.read()).security?.enabled) requireSensitive(token);
      const secret = base32(randomBytes(20));
      await deps.mutate(async (db) => {
        await pending.replace(secret);
        db.security ??= { enabled: false, counter: -1, recoveryHashes: [] };
        db.security.pendingAt = new Date().toISOString();
        deps.audit(
          db,
          "seguranca.mfa.preparado",
          deps.storeId,
          "Cadastro de autenticador iniciado",
        );
      });
      return {
        secret,
        uri: `otpauth://totp/${encodeURIComponent(`Açaí Labor:${deps.storeId}`)}?secret=${secret}&issuer=${encodeURIComponent("Açaí Labor")}&algorithm=SHA1&digits=6&period=30`,
      };
    },
    async confirm(token: string | undefined, code: string, enrollment = false) {
      deps.requireAdmin(token);
      const key = hash(token!);
      const failed = attempts.get(key);
      if (failed && failed.until > Date.now() && failed.count >= 5)
        throw new Error("Muitas tentativas MFA. Aguarde 15 minutos.");
      attempts.set(key, {
        count: failed && failed.until > Date.now() ? failed.count + 1 : 1,
        until: Date.now() + 900000,
      });
      const recoveryCandidate =
        !enrollment && (await deps.read()).security?.recoveryHashes.includes(hash(code)) === true;
      const secret = recoveryCandidate ? "" : await (enrollment ? pending : vault).get();
      const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(9).toString("hex"));
      const ok = await deps.mutate(async (db) => {
        const s = db.security;
        if (
          !s ||
          (enrollment ? !s.pendingAt || Date.parse(s.pendingAt) < Date.now() - 600000 : !s.enabled)
        )
          return false;
        if (enrollment && s.enabled) requireSensitive(token);
        const recovery = !enrollment && s.recoveryHashes.includes(hash(code));
        const counter = secret ? validCounter(secret, code, enrollment ? -1 : s.counter) : -1;
        if (!recovery && counter < 0) return false;
        if (enrollment) {
          await vault.replace(secret);
          s.enabled = true;
          s.recoveryHashes = recoveryCodes.map(hash);
          delete s.pendingAt;
        }
        if (recovery) s.recoveryHashes = s.recoveryHashes.filter((h) => h !== hash(code));
        else s.counter = counter;
        deps.audit(
          db,
          enrollment ? "seguranca.mfa.ativado" : "seguranca.mfa.validado",
          deps.storeId,
          recovery ? "Código de recuperação utilizado" : "Autenticador confirmado",
        );
        return true;
      });
      if (!ok) throw new Error("Código inválido, expirado ou já utilizado.");
      attempts.delete(key);
      grants.set(key, Date.now() + 300000);
      return { ok: true, recoveryCodes: enrollment ? recoveryCodes : [] };
    },
  };
}
