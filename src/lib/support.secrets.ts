// Server only. Windows DPAPI binds secrets to the current OS user.
import { execFile } from "node:child_process";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let dpapiQueue: Promise<unknown> = Promise.resolve();

function dpapi(value: string, decrypt: boolean, purpose: string): Promise<string> {
  const script = `Add-Type -AssemblyName System.Security; $payload = [Console]::In.ReadToEnd(); $bytes = [Convert]::FromBase64String($payload); $result = [Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($bytes, [Text.Encoding]::UTF8.GetBytes('acai-labor-${purpose}-v1'), [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  const work = () => new Promise<string>((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(new Error("Não foi possível acessar o cofre do sistema operacional."));
        else resolve(stdout.trim());
      },
    );
    child.stdin!.end(value);
  });
  const result = dpapiQueue.then(work);
  dpapiQueue = result.catch(() => {});
  return result;
}
function masterKey() {
  const configured = process.env["LABOR_SECRET_KEY"];
  const serviceRoleKey = process.env["LABOR_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const key = configured
    ? Buffer.from(configured, "base64")
    : (process.env["LABOR_STORAGE"] === "supabase" || Boolean(process.env["LABOR_SUPABASE_SERVICE_ROLE_KEY"])) && serviceRoleKey
      ? createHash("sha256")
          .update(`acai-labor-vault-v1:${serviceRoleKey}`)
          .digest()
      : Buffer.alloc(0);
  if (key.length !== 32)
    throw new Error("Configure LABOR_SECRET_KEY com 32 bytes em base64 no servidor.");
  return key;
}
export function createSupportVault(directory: string, purpose = "gemini") {
  if (!/^[a-z0-9-]{1,50}$/.test(purpose)) throw new Error("Finalidade de cofre inválida.");
  const path = join(directory, `${purpose}-secret.json`);
  const remote = process.env["LABOR_STORAGE"] === "supabase" || Boolean(process.env["LABOR_SUPABASE_SERVICE_ROLE_KEY"]);
  const storeId = process.env["LABOR_STORE_ID"] || "acai-labor";
  async function readRecord() {
    if (remote) {
      const response = await (supabaseAdmin as any)
        .from("labor_secrets")
        .select("envelope")
        .eq("store_id", storeId)
        .eq("purpose", purpose)
        .maybeSingle();
      if (response.error) throw new Error("Cofre do banco indisponível.");
      return response.data?.envelope || null;
    }
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new Error("Cofre indisponível.");
    }
  }
  return {
    async configured() {
      if (purpose === "gemini" && process.env["GEMINI_API_KEY"]) return true;
      return Boolean(await readRecord());
    },
    async get() {
      let record: { kind: string; data: string; iv?: string; tag?: string };
      const saved = await readRecord();
      if (!saved) {
        return purpose === "gemini" ? process.env["GEMINI_API_KEY"] || "" : "";
      }
      record = saved;
      if (record.kind === "dpapi")
        return Buffer.from(await dpapi(record.data, true, purpose), "base64").toString("utf8");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        masterKey(),
        Buffer.from(record.iv!, "base64"),
      );
      decipher.setAAD(Buffer.from(`acai-labor-${purpose}-v1`));
      decipher.setAuthTag(Buffer.from(record.tag!, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(record.data, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
    async replace(key: string) {
      let record: { kind: string; data: string; iv?: string; tag?: string };
      // A configured server key takes precedence even on Windows. This keeps
      // deploys portable and lets automated processes use AES-GCM without an
      // interactive Windows profile, while local Windows installs still use
      // DPAPI by default.
      if (!remote && process.platform === "win32" && !process.env["LABOR_SECRET_KEY"])
        record = {
          kind: "dpapi",
          data: await dpapi(Buffer.from(key).toString("base64"), false, purpose),
        };
      else {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
        cipher.setAAD(Buffer.from(`acai-labor-${purpose}-v1`));
        record = {
          kind: "aes-gcm",
          data: Buffer.concat([cipher.update(key, "utf8"), cipher.final()]).toString("base64"),
          iv: iv.toString("base64"),
          tag: cipher.getAuthTag().toString("base64"),
        };
      }
      if (remote) {
        const response = await (supabaseAdmin as any).from("labor_secrets").upsert(
          { store_id: storeId, purpose, envelope: record, updated_at: new Date().toISOString() },
          { onConflict: "store_id,purpose" },
        );
        if (response.error) throw new Error("Não foi possível salvar o segredo no banco.");
      } else {
        await mkdir(directory, { recursive: true });
        const temporary = join(directory, `secret-${randomUUID()}.tmp`);
        await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
        await rename(temporary, path);
      }
    },
  };
}
