// Server-only storage for the Açaí Labor service. Each write uses an atomic
// version check, so separate serverless instances cannot silently overwrite
// each other's orders or administrative changes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LaborDatabase } from "./labor.types";
import { migrateV2 } from "./vendrex.rules";

type StateRow = { version: number | string; payload: LaborDatabase };
type PasswordRow = { username: string; salt: string; password_hash: string };
const client = supabaseAdmin as any;

export function createLaborSupabaseStorage(storeId: string, seed: LaborDatabase) {
  async function state(): Promise<StateRow> {
    const existing = await client
      .from("labor_state")
      .select("version,payload")
      .eq("store_id", storeId)
      .maybeSingle();
    if (existing.error) throw new Error(`Falha ao ler o banco: ${existing.error.message}`);
    if (existing.data) return existing.data as StateRow;

    const initial = { ...migrateV2(structuredClone(seed)), store_id: storeId };
    const inserted = await client
      .from("labor_state")
      .upsert({ store_id: storeId, version: 0, payload: initial }, { onConflict: "store_id", ignoreDuplicates: true });
    if (inserted.error) throw new Error(`Falha ao iniciar o banco: ${inserted.error.message}`);
    const loaded = await client
      .from("labor_state")
      .select("version,payload")
      .eq("store_id", storeId)
      .single();
    if (loaded.error || !loaded.data)
      throw new Error(`Falha ao iniciar o banco: ${loaded.error?.message || "estado ausente"}`);
    return loaded.data as StateRow;
  }

  async function read() {
    const row = await state();
    const db = migrateV2(structuredClone(row.payload));
    if (db.store_id !== storeId) throw new Error("Banco pertence a outro estabelecimento.");
    return db;
  }

  async function mutate<T>(fn: (db: LaborDatabase) => T | Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const row = await state();
      const db = migrateV2(structuredClone(row.payload));
      if (db.store_id !== storeId) throw new Error("Banco pertence a outro estabelecimento.");
      const result = await fn(db);
      const version = Number(row.version);
      if (!Number.isSafeInteger(version)) throw new Error("Versão inválida do banco.");
      const saved = await client
        .from("labor_state")
        .update({ payload: db, version: version + 1, updated_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .eq("version", row.version)
        .select("version")
        .maybeSingle();
      if (saved.error) throw new Error(`Falha ao salvar no banco: ${saved.error.message}`);
      if (saved.data) return result;
    }
    throw new Error("Muitos pedidos simultâneos. Tente confirmar novamente.");
  }

  async function passwordRecord(): Promise<{ username: string; salt: string; hash: string } | null> {
    const response = await client
      .from("labor_admin_credentials")
      .select("username,salt,password_hash")
      .eq("store_id", storeId)
      .maybeSingle();
    if (response.error) throw new Error(`Falha ao consultar o administrador: ${response.error.message}`);
    const record = response.data as PasswordRow | null;
    return record ? { username: record.username, salt: record.salt, hash: record.password_hash } : null;
  }

  async function createPasswordRecord(record: { username: string; salt: string; hash: string }) {
    const response = await client.from("labor_admin_credentials").insert({
      store_id: storeId,
      username: record.username,
      salt: record.salt,
      password_hash: record.hash,
    });
    if (response.error) {
      if (response.error.code === "23505")
        throw new Error("O administrador já está configurado. Entre com sua senha.");
      throw new Error(`Falha ao configurar administrador: ${response.error.message}`);
    }
  }

  async function createSession(tokenHash: string, expiresAt: string) {
    const response = await client.from("labor_admin_sessions").insert({
      store_id: storeId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (response.error) throw new Error(`Falha ao guardar a sessão: ${response.error.message}`);
  }

  async function sessionActive(tokenHash: string) {
    const response = await client
      .from("labor_admin_sessions")
      .select("expires_at,revoked_at")
      .eq("store_id", storeId)
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (response.error) throw new Error(`Falha ao verificar a sessão: ${response.error.message}`);
    return Boolean(response.data && !response.data.revoked_at && Date.parse(response.data.expires_at) > Date.now());
  }

  async function revokeSession(tokenHash: string) {
    const response = await client
      .from("labor_admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("token_hash", tokenHash);
    if (response.error) throw new Error(`Falha ao encerrar a sessão: ${response.error.message}`);
  }

  return { read, mutate, passwordRecord, createPasswordRecord, createSession, sessionActive, revokeSession };
}
