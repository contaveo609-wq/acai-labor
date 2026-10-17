-- ENUMS
create type public.app_role as enum ('admin','cliente');
create type public.order_status as enum ('recebido','confirmado','em_preparacao','saiu_entrega','entregue','cancelado');
create type public.payment_method as enum ('pix','cartao','dinheiro');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'cliente') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  emoji text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "admin manage categories" on public.categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,2) not null default 0,
  price_from boolean not null default false,
  weight text,
  quantity_label text,
  serves int,
  is_active boolean not null default true,
  is_sold_out boolean not null default false,
  is_featured boolean not null default false,
  featured_order int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "admin manage products" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false
);
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;
alter table public.product_images enable row level security;
create policy "public read product_images" on public.product_images for select to anon, authenticated using (true);
create policy "admin manage product_images" on public.product_images for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  is_required boolean not null default false,
  sort_order int not null default 0
);
grant select on public.addon_groups to anon, authenticated;
grant insert, update, delete on public.addon_groups to authenticated;
grant all on public.addon_groups to service_role;
alter table public.addon_groups enable row level security;
create policy "public read addon_groups" on public.addon_groups for select to anon, authenticated using (true);
create policy "admin manage addon_groups" on public.addon_groups for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.product_addons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.addon_groups(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0
);
grant select on public.product_addons to anon, authenticated;
grant insert, update, delete on public.product_addons to authenticated;
grant all on public.product_addons to service_role;
alter table public.product_addons enable row level security;
create policy "public read product_addons" on public.product_addons for select to anon, authenticated using (true);
create policy "admin manage product_addons" on public.product_addons for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PROMOTIONS
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  title text,
  promo_price numeric(10,2),
  discount_percent numeric(5,2),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.promotions to anon, authenticated;
grant insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;
alter table public.promotions enable row level security;
create policy "public read promotions" on public.promotions for select to anon, authenticated using (true);
create policy "admin manage promotions" on public.promotions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ADDRESSES
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  reference text,
  city text not null default 'Rondonópolis',
  state text not null default 'MT',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.addresses to authenticated;
grant all on public.addresses to service_role;
alter table public.addresses enable row level security;
create policy "own addresses" on public.addresses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ORDERS
create sequence public.order_number_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null default nextval('public.order_number_seq'),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  reference text,
  city text not null default 'Rondonópolis',
  payment_method public.payment_method not null,
  change_for numeric(10,2),
  status public.order_status not null default 'recebido',
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "admin orders all" on public.orders for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null,
  line_total numeric(10,2) not null,
  notes text
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "own order items read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "admin order items all" on public.order_items for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_item_addons (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_id uuid references public.product_addons(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null default 1
);
grant select on public.order_item_addons to authenticated;
grant all on public.order_item_addons to service_role;
alter table public.order_item_addons enable row level security;
create policy "own order addons read" on public.order_item_addons for select to authenticated
  using (exists (select 1 from public.order_items i join public.orders o on o.id=i.order_id
                 where i.id = order_item_id and o.user_id = auth.uid()));
create policy "admin order addons all" on public.order_item_addons for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- SETTINGS
create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'Skina do Frango & Assados',
  tagline text not null default 'Frangos assados, carnes na brasa e combos de família',
  description text not null default 'Peça online os melhores assados de Rondonópolis. Costela no bafo 8 horas, carnes na brasa, combos completos e bebidas geladas.',
  logo_url text,
  banner_url text,
  address_line text not null default 'Jardim Primavera — Rondonópolis/MT',
  delivery_time_min int not null default 40,
  delivery_time_max int not null default 57,
  delivery_fee numeric(10,2) not null default 0,
  whatsapp text not null default '556681055779',
  phone text not null default '(66) 8105-5779',
  opening_hours text not null default 'Todos os dias, 10h às 15h',
  is_open boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "public read store settings" on public.store_settings for select to anon, authenticated using (true);
create policy "admin update store settings" on public.store_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.store_settings (id) values (true);

create table public.chatbot_settings (
  id boolean primary key default true check (id),
  is_enabled boolean not null default true,
  bot_name text not null default 'Atendente Virtual Skina',
  welcome_message text not null default 'Olá! Sou o Atendente Virtual da Skina do Frango & Assados. Posso te ajudar com o cardápio, preços e a montar seu pedido.',
  fallback_message text not null default 'Não tenho essa informação no momento. Vou encaminhar você para nosso atendimento no WhatsApp.',
  whatsapp text not null default '556681055779',
  faqs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
grant select on public.chatbot_settings to anon, authenticated;
grant update on public.chatbot_settings to authenticated;
grant all on public.chatbot_settings to service_role;
alter table public.chatbot_settings enable row level security;
create policy "public read chatbot settings" on public.chatbot_settings for select to anon, authenticated using (true);
create policy "admin update chatbot settings" on public.chatbot_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.chatbot_settings (id) values (true);