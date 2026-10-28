import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;`);
for (const file of ["20261016010000_delivery_multistore.sql", "20261017010000_vendrex_phase1.sql"])
  await db.exec(await readFile(new URL(`../docs/legacy-skina-migrations/${file}`, import.meta.url), "utf8"));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [a, b, ua, ub, uc, ca, cb, pa, pb, oa, ob] = Array.from({ length: 11 }, (_, i) => id(i + 1));
await db.exec(`insert into auth.users values ('${ua}'),('${ub}'),('${uc}');
insert into delivery_stores(id,slug,name,is_active) values('${a}','a','Loja A',true),('${b}','b','Loja B',true);
insert into delivery_memberships values('${a}','${ua}','owner'),('${b}','${ub}','admin');
insert into delivery_categories(id,store_id,name) values('${ca}','${a}','Categoria A'),('${cb}','${b}','Categoria B');
insert into delivery_products(id,store_id,category_id,name,price_cents) values('${pa}','${a}','${ca}','Produto A',1000),('${pb}','${b}','${cb}','Produto B',2000);
insert into delivery_orders(id,store_id,user_id,fulfillment,payment_method,subtotal_cents,fee_cents,total_cents) values('${oa}','${a}','${uc}','pickup','pix',1000,0,1000),('${ob}','${b}',null,'delivery','pix',2000,0,2000);`);
async function asUser(user: string | null, sql: string) {
  await db.exec(
    `set role ${user ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub','${user || ""}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false);");
  }
}
after(async () => db.close());
test("RLS: anônimo vê catálogo ativo e não acessa pedidos", async () => {
  assert.equal((await asUser(null, "select * from delivery_products")).rows.length, 2);
  await assert.rejects(asUser(null, "select * from delivery_orders"), /permission denied/);
  await db.exec(`update delivery_products set is_active=false where id='${pb}'`);
  assert.equal((await asUser(null, "select * from delivery_products")).rows.length, 1);
  await db.exec(
    `update delivery_products set is_active=true where id='${pb}'; update delivery_categories set is_active=false where id='${cb}'`,
  );
  assert.equal((await asUser(null, "select * from delivery_products")).rows.length, 1);
  await db.exec(`update delivery_categories set is_active=true where id='${cb}'`);
});
test("RLS: cada admin só vê pedidos de sua loja e cliente só vê os seus", async () => {
  assert.deepEqual(
    (await asUser(ua!, "select id from delivery_orders")).rows.map((r: any) => r.id),
    [oa],
  );
  assert.deepEqual(
    (await asUser(ub!, "select id from delivery_orders")).rows.map((r: any) => r.id),
    [ob],
  );
  assert.deepEqual(
    (await asUser(uc!, "select id from delivery_orders")).rows.map((r: any) => r.id),
    [oa],
  );
});
test("RLS: impede preço cross-tenant e vínculo entre categorias de lojas distintas", async () => {
  assert.equal(
    (await asUser(ua!, `update delivery_products set price_cents=1 where id='${pb}' returning id`))
      .rows.length,
    0,
  );
  await assert.rejects(
    asUser(
      ua!,
      `insert into delivery_products(store_id,category_id,name,price_cents) values('${a}','${cb}','Intruso',1)`,
    ),
    /foreign key/,
  );
  assert.equal(
    (
      await asUser(
        ua!,
        `update delivery_products set price_cents=1100 where id='${pa}' returning id`,
      )
    ).rows.length,
    1,
  );
});
test("RLS: não permite autopromoção nem alteração financeira direta", async () => {
  await assert.rejects(
    asUser(uc!, `insert into delivery_memberships values('${b}','${uc}','owner')`),
    /permission denied/,
  );
  await assert.rejects(
    asUser(ua!, `update delivery_orders set payment_status='pago' where id='${oa}'`),
    /permission denied/,
  );
  await assert.rejects(
    asUser(ua!, `update delivery_orders set total_cents=1 where id='${oa}'`),
    /permission denied/,
  );
});
test("RPC: valida loja, papel, transição e concorrência; preserva financeiro", async () => {
  await assert.rejects(
    asUser(ua!, `select delivery_transition_order('${b}','${ob}','em_preparacao','recebido')`),
    /não autorizado/,
  );
  await assert.rejects(
    asUser(uc!, `select delivery_transition_order('${a}','${oa}','em_preparacao','recebido')`),
    /não autorizado/,
  );
  await assert.rejects(
    asUser(ua!, `select delivery_transition_order('${a}','${oa}','concluido','recebido')`),
    /Transição/,
  );
  await asUser(ua!, `select delivery_transition_order('${a}','${oa}','em_preparacao','recebido')`);
  await assert.rejects(
    asUser(ua!, `select delivery_transition_order('${a}','${oa}','pronto','recebido')`),
    /outro atendimento/,
  );
  await asUser(ua!, `select delivery_transition_order('${a}','${oa}','pronto','em_preparacao')`);
  await asUser(ua!, `select delivery_transition_order('${a}','${oa}','concluido','pronto')`);
  assert.equal(
    (await db.query<any>(`select payment_status from delivery_orders where id='${oa}'`)).rows[0]
      .payment_status,
    "pendente",
  );
});
test("auditoria: escrita automática, isolamento por loja e sem alterações do cliente", async () => {
  const rows = (await asUser(ua!, "select * from delivery_audit")).rows as any[];
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.store_id === a));
  assert.equal((await asUser(uc!, "select * from delivery_audit")).rows.length, 0);
  await assert.rejects(asUser(ua!, "delete from delivery_audit"), /permission denied/);
  assert.equal((await asUser(ua!, "select * from delivery_order_history")).rows.length, 3);
  assert.equal((await asUser(ub!, "select * from delivery_order_history")).rows.length, 0);
});
