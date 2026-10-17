-- Apply only after the isolated delivery_multistore migration, in staging.
-- Does not modify legacy Skina tables. UI local adapter remains independent.
begin;
alter table public.delivery_products
 add column sku text,
 add column sale_unit text not null default 'unidade' check(sale_unit in ('unidade','kg','litro','caixa','fardo','pacote','combo')),
 add column min_quantity numeric(12,3) not null default 1 check(min_quantity>0 and min_quantity<=1000),
 add column quantity_step numeric(12,3) not null default 1 check(quantity_step>0 and quantity_step<=1000);
create unique index delivery_product_sku on public.delivery_products(store_id,sku) where sku is not null and sku<>'';
alter table public.delivery_variations
 add column sale_unit text not null default 'unidade' check(sale_unit in ('unidade','kg','litro','caixa','fardo','pacote','combo')),
 add column min_quantity numeric(12,3) not null default 1 check(min_quantity>0 and min_quantity<=1000),
 add column quantity_step numeric(12,3) not null default 1 check(quantity_step>0 and quantity_step<=1000);
alter table public.delivery_addon_groups add column is_required boolean not null default false;
alter table public.delivery_orders drop constraint delivery_orders_status_check;
alter table public.delivery_orders add constraint delivery_orders_status_check check(status in ('recebido','em_preparacao','pronto','saiu_entrega','entregue','concluido','cancelado'));
alter table public.delivery_orders
 add column payment_status text not null default 'pendente' check(payment_status in ('pendente','em_analise','pago','recusado','reembolsado')),
 add column scheduled_for timestamptz,
 add column request_id uuid,
 add column request_hash text;
create unique index delivery_order_idempotency on public.delivery_orders(store_id,user_id,request_id) where user_id is not null and request_id is not null;
alter table public.delivery_orders drop constraint delivery_orders_payment_method_check;
alter table public.delivery_orders add constraint delivery_orders_payment_method_check check(payment_method in ('pix','cartao','dinheiro','credito_entrega','debito_entrega'));
alter table public.delivery_order_items drop constraint delivery_order_items_quantity_check;
alter table public.delivery_order_items alter column quantity type numeric(12,3);
alter table public.delivery_order_items add constraint delivery_order_items_quantity_check check(quantity>0 and quantity<=1000);
alter table public.delivery_order_items add column sale_label text;

-- Public catalogue must respect active store, category, product and child state.
drop policy catalog_read on public.delivery_categories;
create policy catalog_read on public.delivery_categories for select using(is_active and exists(select 1 from public.delivery_stores s where s.id=store_id and s.is_active));
drop policy catalog_read on public.delivery_products;
create policy catalog_read on public.delivery_products for select using(is_active and exists(select 1 from public.delivery_categories c where c.store_id=delivery_products.store_id and c.id=category_id and c.is_active) and exists(select 1 from public.delivery_stores s where s.id=store_id and s.is_active));
drop policy catalog_read on public.delivery_variations;
create policy catalog_read on public.delivery_variations for select using(is_active and exists(select 1 from public.delivery_products p where p.store_id=delivery_variations.store_id and p.id=product_id and p.is_active));
drop policy catalog_read on public.delivery_addon_groups;
create policy catalog_read on public.delivery_addon_groups for select using(exists(select 1 from public.delivery_products p where p.store_id=delivery_addon_groups.store_id and p.id=product_id and p.is_active));
drop policy catalog_read on public.delivery_addons;
create policy catalog_read on public.delivery_addons for select using(is_active and exists(select 1 from public.delivery_addon_groups g where g.store_id=delivery_addons.store_id and g.id=group_id));
drop policy catalog_read on public.delivery_promotions;
create policy catalog_read on public.delivery_promotions for select using(is_active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) and exists(select 1 from public.delivery_stores s where s.id=store_id and s.is_active) and (product_id is null or exists(select 1 from public.delivery_products p where p.store_id=delivery_promotions.store_id and p.id=product_id and p.is_active)));

-- Browser roles cannot edit money, payment status, customer IDs or order contents.
revoke insert,update,delete on public.delivery_orders,public.delivery_order_items,public.delivery_customers from authenticated,anon;
create table public.delivery_audit (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.delivery_stores(id),
 actor uuid, action text not null, resource_id uuid not null, detail text not null,
 created_at timestamptz not null default now()
);
alter table public.delivery_audit enable row level security;
revoke all on public.delivery_audit from public,anon,authenticated;
grant select on public.delivery_audit to authenticated;
create policy audit_read on public.delivery_audit for select to authenticated using(public.delivery_is_admin(store_id));
create function public.delivery_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; tenant uuid;
begin
 row_data=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
 tenant=case when TG_TABLE_NAME='delivery_stores' then (row_data->>'id')::uuid else (row_data->>'store_id')::uuid end;
 insert into public.delivery_audit(store_id,actor,action,resource_id,detail) values(tenant,auth.uid(),TG_TABLE_NAME||'.'||lower(TG_OP),(row_data->>'id')::uuid,
 case when TG_TABLE_NAME='delivery_orders' then coalesce(row_data->>'status','') else 'Registro alterado' end);
 return case when TG_OP='DELETE' then OLD else NEW end;
end $$;
revoke all on function public.delivery_audit_change() from public;
create trigger audit_product after insert or update or delete on public.delivery_products for each row execute function public.delivery_audit_change();
create trigger audit_category after insert or update or delete on public.delivery_categories for each row execute function public.delivery_audit_change();
create trigger audit_store after update on public.delivery_stores for each row execute function public.delivery_audit_change();
create trigger audit_order after insert or update on public.delivery_orders for each row execute function public.delivery_audit_change();
create table public.delivery_order_history (
 id uuid primary key default gen_random_uuid(), store_id uuid not null, order_id uuid not null,
 status text not null, reason text, actor uuid not null, created_at timestamptz not null default now(),
 foreign key(store_id,order_id) references public.delivery_orders(store_id,id)
);
alter table public.delivery_order_history enable row level security;
grant select on public.delivery_order_history to authenticated;
create policy history_read on public.delivery_order_history for select to authenticated using(public.delivery_is_admin(store_id) or exists(select 1 from public.delivery_orders o where o.store_id=delivery_order_history.store_id and o.id=order_id and o.user_id=auth.uid()));
create function public.delivery_transition_order(target_store uuid,target_order uuid,next_status text,expected_status text,cancel_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare current_order public.delivery_orders;
begin
 if auth.uid() is null or not public.delivery_is_admin(target_store) then raise exception 'Acesso não autorizado'; end if;
 select * into current_order from public.delivery_orders where store_id=target_store and id=target_order for update;
 if not found then raise exception 'Pedido não encontrado'; end if;
 if current_order.status<>expected_status then raise exception 'Pedido atualizado por outro atendimento'; end if;
 if current_order.status=next_status then return; end if;
 if next_status='cancelado' then
   if current_order.status in ('entregue','concluido','cancelado') or length(trim(coalesce(cancel_reason,'')))<3 or length(cancel_reason)>300 then raise exception 'Cancelamento inválido'; end if;
 elsif not (
  (current_order.status='recebido' and next_status='em_preparacao') or
  (current_order.status='em_preparacao' and next_status='pronto') or
  (current_order.status='pronto' and current_order.fulfillment='delivery' and next_status='saiu_entrega') or
  (current_order.status='pronto' and current_order.fulfillment='pickup' and next_status='concluido') or
  (current_order.status='saiu_entrega' and next_status='entregue') or
  (current_order.status='entregue' and next_status='concluido')
 ) then raise exception 'Transição inválida'; end if;
 update public.delivery_orders set status=next_status where id=target_order and store_id=target_store;
 insert into public.delivery_order_history(store_id,order_id,status,reason,actor) values(target_store,target_order,next_status,case when next_status='cancelado' then trim(cancel_reason) else null end,auth.uid());
end $$;
revoke all on function public.delivery_transition_order(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.delivery_transition_order(uuid,uuid,text,text,text) to authenticated;
commit;
