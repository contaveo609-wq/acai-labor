-- Preparação independente: não modifica as tabelas do restaurante Skina.
-- Revisar e aplicar em projeto Supabase de homologação antes da integração.
begin;
create table public.delivery_stores (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, theme jsonb not null default '{}'::jsonb,
 settings jsonb not null default '{}'::jsonb, is_active boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.delivery_memberships (
 store_id uuid not null references public.delivery_stores(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin')), primary key(store_id,user_id)
);
create function public.delivery_is_admin(target_store uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.delivery_memberships m where m.store_id=target_store and m.user_id=auth.uid());
$$;
revoke all on function public.delivery_is_admin(uuid) from public;
grant execute on function public.delivery_is_admin(uuid) to anon,authenticated;
create table public.delivery_categories (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.delivery_stores(id),
 name text not null, sort_order integer not null default 0, is_active boolean not null default true,
 unique(store_id,id)
);
create table public.delivery_products (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.delivery_stores(id),
 category_id uuid,name text not null,description text,price_cents integer not null check(price_cents>0),
 image_url text,is_active boolean not null default true,is_sold_out boolean not null default false,
 is_featured boolean not null default false,sort_order integer not null default 0,
 unique(store_id,id), foreign key(store_id,category_id) references public.delivery_categories(store_id,id)
);
create table public.delivery_variations (
 id uuid primary key default gen_random_uuid(),store_id uuid not null,product_id uuid not null,
 name text not null,price_cents integer not null check(price_cents>=0),is_active boolean not null default true,
 foreign key(store_id,product_id) references public.delivery_products(store_id,id),unique(store_id,id)
);
create table public.delivery_addon_groups (
 id uuid primary key default gen_random_uuid(),store_id uuid not null,product_id uuid not null,
 title text not null,min_select integer not null default 0 check(min_select>=0),
 max_select integer not null default 1 check(max_select>=min_select and max_select>0),
 foreign key(store_id,product_id) references public.delivery_products(store_id,id),unique(store_id,id)
);
create table public.delivery_addons (
 id uuid primary key default gen_random_uuid(),store_id uuid not null,group_id uuid not null,
 name text not null,price_cents integer not null default 0 check(price_cents>=0),is_active boolean not null default true,
 foreign key(store_id,group_id) references public.delivery_addon_groups(store_id,id),unique(store_id,id)
);
create table public.delivery_promotions (
 id uuid primary key default gen_random_uuid(),store_id uuid not null,product_id uuid,
 code text,price_cents integer check(price_cents>0),discount_percent integer check(discount_percent between 1 and 99),
 starts_at timestamptz,ends_at timestamptz,is_active boolean not null default false,
 check(ends_at is null or starts_at is null or ends_at>=starts_at),
 foreign key(store_id,product_id) references public.delivery_products(store_id,id)
);
create table public.delivery_customers (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.delivery_stores(id),
 user_id uuid references auth.users(id),name text not null,phone text not null,unique(store_id,id)
);
create table public.delivery_orders (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.delivery_stores(id),
 customer_id uuid, user_id uuid references auth.users(id),number bigint generated always as identity,
 status text not null default 'recebido' check(status in ('recebido','em_preparacao','pronto','saiu_entrega','entregue','cancelado')),
 is_test boolean not null default true,fulfillment text not null check(fulfillment in ('delivery','pickup')),
 address jsonb not null default '{}'::jsonb,payment_method text not null check(payment_method in ('pix','cartao','dinheiro')),
 subtotal_cents integer not null check(subtotal_cents>=0),fee_cents integer not null check(fee_cents>=0),
 discount_cents integer not null default 0 check(discount_cents>=0),total_cents integer not null check(total_cents=subtotal_cents+fee_cents-discount_cents),
 notes text,created_at timestamptz not null default now(),unique(store_id,id),
 foreign key(store_id,customer_id) references public.delivery_customers(store_id,id)
);
create table public.delivery_order_items (
 id uuid primary key default gen_random_uuid(),store_id uuid not null,order_id uuid not null,product_id uuid not null,
 product_name text not null,quantity integer not null check(quantity between 1 and 50),
 unit_price_cents integer not null check(unit_price_cents>0),addons jsonb not null default '[]'::jsonb,
 line_total_cents integer not null check(line_total_cents>0),notes text,
 foreign key(store_id,order_id) references public.delivery_orders(store_id,id),
 foreign key(store_id,product_id) references public.delivery_products(store_id,id)
);
create index delivery_orders_store_created on public.delivery_orders(store_id,created_at desc);
create index delivery_memberships_user on public.delivery_memberships(user_id);
create index delivery_products_store on public.delivery_products(store_id);
alter table public.delivery_stores enable row level security;
alter table public.delivery_memberships enable row level security;
create policy delivery_store_public on public.delivery_stores for select using(is_active or public.delivery_is_admin(id));
create policy delivery_store_admin on public.delivery_stores for update to authenticated using(public.delivery_is_admin(id)) with check(public.delivery_is_admin(id));
-- Membership changes require a privileged server/console. Never allow self-promotion.
create policy delivery_membership_self on public.delivery_memberships for select to authenticated using(user_id=auth.uid());
do $$ declare table_name text; begin
 foreach table_name in array array['delivery_categories','delivery_products','delivery_variations','delivery_addon_groups','delivery_addons','delivery_promotions'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('create policy catalog_read on public.%I for select using (exists(select 1 from public.delivery_stores s where s.id=store_id and s.is_active) or public.delivery_is_admin(store_id))',table_name);
  execute format('create policy catalog_manage on public.%I for all to authenticated using(public.delivery_is_admin(store_id)) with check(public.delivery_is_admin(store_id))',table_name);
 end loop;
 foreach table_name in array array['delivery_customers','delivery_orders','delivery_order_items'] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('create policy tenant_admin on public.%I for all to authenticated using(public.delivery_is_admin(store_id)) with check(public.delivery_is_admin(store_id))',table_name);
 end loop;
end $$;
create policy delivery_customer_own on public.delivery_customers for select to authenticated using(user_id=auth.uid());
create policy delivery_order_own on public.delivery_orders for select to authenticated using(user_id=auth.uid());
create policy delivery_items_own on public.delivery_order_items for select to authenticated using(exists(select 1 from public.delivery_orders o where o.id=order_id and o.user_id=auth.uid()));
grant select on public.delivery_stores,public.delivery_categories,public.delivery_products,public.delivery_variations,public.delivery_addon_groups,public.delivery_addons,public.delivery_promotions to anon,authenticated;
grant select on public.delivery_memberships,public.delivery_customers,public.delivery_orders,public.delivery_order_items to authenticated;
grant insert,update,delete on public.delivery_categories,public.delivery_products,public.delivery_variations,public.delivery_addon_groups,public.delivery_addons,public.delivery_promotions to authenticated;
grant update on public.delivery_stores,public.delivery_orders to authenticated;
-- Nenhum INSERT de pedido é concedido ao navegador. O futuro adaptador deve
-- reutilizar a validação de labor.service.ts no servidor e gravar toda a compra
-- em uma transação/RPC restrita. O schema, sozinho, NÃO habilita checkout online.
commit;
