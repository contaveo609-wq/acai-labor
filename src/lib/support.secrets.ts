// Server only. Windows DPAPI binds secrets to the current OS user.
import { execFile } from "node:child_process";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";

function dpapi(value: string, decrypt: boolean, purpose: string): Promise<string> {
  const script = `Add-Type -AssemblyName System.Security; $payload = [Console]::In.ReadToEnd(); $bytes = [Convert]::FromBase64String($payload); $result = [Security.Cryptography.ProtectedData]::${decrypt ? "Unprotect" : "Protect"}($bytes, [Text.Encoding]::UTF8.GetBytes('acai-labor-${purpose}-v1'), [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`;
  return new Promise((resolve, reject) => {
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
}
function masterKey() {
  const key = Buffer.from(process.env["LABOR_SECRET_KEY"] || "", "base64");
  if (key.length !== 32)
    throw new Error("Configure LABOR_SECRET_KEY com 32 bytes em base64 no servidor.");
  return key;
}
export function createSupportVault(directory: string, purpose = "gemini") {
  if (!/^[a-z0-9-]{1,50}$/.test(purpose)) throw new Error("Finalidade de cofre inválida.");
  const path = join(directory, `${purpose}-secret.json`);
  return {
    async configured() {
      if (purpose === "gemini" && process.env["GEMINI_API_KEY"]) return true;
      try {
        await readFile(path);
        return true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw e;
      }
    },
    async get() {
      let record: { kind: string; data: string; iv?: string; tag?: string };
      try {
        record = JSON.parse(await readFile(path, "utf8"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Cofre indisponível.");
        return purpose === "gemini" ? process.env["GEMINI_API_KEY"] || "" : "";
      }
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
      if (process.platform === "win32")
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
      await mkdir(directory, { recursive: true });
      const temporary = join(directory, `secret-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await rename(temporary, path);
    },
  };
}
