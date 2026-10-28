-- Commandes par table pour Chez Papa.
-- Les clients n'ont aucun accès direct : seul le rôle serveur (service_role) passe par l'API.
-- Realtime n'est pas activé sur ces tables, pour ne pas diffuser l'état des tables aux clients.

create sequence public.order_number_seq start with 1001;

create table public.restaurant_settings (
  id integer primary key default 1 check (id = 1),
  table_count integer not null default 10 check (table_count between 1 and 200),
  updated_at timestamptz not null default now()
);

insert into public.restaurant_settings (id, table_count) values (1, 10);

create table public.restaurant_tables (
  number integer primary key check (number between 1 and 200),
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.restaurant_tables (number, label)
select n, 'Table ' || n from generate_series(1, 10) as n;

create table public.restaurant_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  disabled boolean not null default false
);

create table public.staff_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.restaurant_users (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_number integer not null references public.restaurant_tables (number),
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index table_sessions_one_open
  on public.table_sessions (table_number)
  where status = 'open';

create table public.table_devices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions (id),
  table_number integer not null,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index table_devices_session on public.table_devices (session_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_number text not null unique,
  table_number integer not null,
  session_id uuid not null references public.table_sessions (id),
  device_id uuid not null references public.table_devices (id),
  status text not null check (status in ('draft', 'submitted', 'ready_for_pickup', 'claimed', 'completed', 'cancelled')),
  note text not null default '',
  total_cents integer not null check (total_cents >= 0),
  client_request_id text not null,
  pickup_token_hash text,
  pickup_token_enc text,
  pickup_status text check (pickup_status in ('active', 'consumed', 'revoked')),
  pickup_expires_at timestamptz,
  paid_at timestamptz,
  submitted_at timestamptz,
  ready_at timestamptz,
  claimed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, client_request_id)
);

create index orders_session_status on public.orders (session_id, status);
create index orders_device_created on public.orders (device_id, created_at desc);
create index orders_pickup_hash on public.orders (pickup_token_hash) where pickup_token_hash is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null check (position >= 0),
  dish_id text not null,
  name text not null,
  qty integer not null check (qty between 1 and 12),
  unit_cents integer not null check (unit_cents >= 0),
  supplement_qty integer not null default 0 check (supplement_qty >= 0),
  supplement_label text,
  supplement_cents integer not null default 0 check (supplement_cents >= 0),
  line_cents integer not null check (line_cents >= 0),
  note text not null default '',
  unique (order_id, position)
);

create index order_items_order on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text,
  created_at timestamptz not null default now()
);

create index order_status_history_order on public.order_status_history (order_id, created_at);

create or replace function public.next_order_number()
returns text
language sql
set search_path = public
as $$
  select 'CP-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.assert_order_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
      (old.status = 'draft' and new.status in ('submitted', 'cancelled')) or
      (old.status = 'submitted' and new.status in ('ready_for_pickup', 'cancelled')) or
      (old.status = 'ready_for_pickup' and new.status in ('claimed', 'cancelled')) or
      (old.status = 'claimed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'transition interdite' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.log_order_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, actor)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      new.last_actor
    );
  end if;
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
  before update on public.table_sessions
  for each row execute function public.set_updated_at();

create trigger orders_assert_transition
  before update on public.orders
  for each row execute function public.assert_order_transition();

create trigger orders_log_status
  after insert or update on public.orders
  for each row execute function public.log_order_status();

revoke all on function public.next_order_number() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.assert_order_transition() from public, anon, authenticated;
revoke all on function public.log_order_status() from public, anon, authenticated;
grant execute on function public.next_order_number() to service_role;

revoke all on sequence public.order_number_seq from public, anon, authenticated;
grant usage, select on sequence public.order_number_seq to service_role;

alter table public.restaurant_settings enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.restaurant_users enable row level security;
alter table public.staff_sessions enable row level security;
alter table public.table_sessions enable row level security;
alter table public.table_devices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

alter table public.restaurant_settings force row level security;
alter table public.restaurant_tables force row level security;
alter table public.restaurant_users force row level security;
alter table public.staff_sessions force row level security;
alter table public.table_sessions force row level security;
alter table public.table_devices force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.order_status_history force row level security;

revoke all on table public.restaurant_settings from anon, authenticated;
revoke all on table public.restaurant_tables from anon, authenticated;
revoke all on table public.restaurant_users from anon, authenticated;
revoke all on table public.staff_sessions from anon, authenticated;
revoke all on table public.table_sessions from anon, authenticated;
revoke all on table public.table_devices from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.order_status_history from anon, authenticated;
