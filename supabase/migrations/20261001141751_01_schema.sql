-- 01_schema: tablas base de Vesta Care

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  birth_date date,
  phone text,
  timezone text not null default 'America/Santiago',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  relation text,
  phone text,
  access_token uuid unique not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_path text,
  extracted jsonb,
  confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  source text not null default 'manual' check (source in ('ficha','manual'))
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dose text,
  schedule jsonb not null default '{}'::jsonb
);

create table public.modules (
  id text primary key,
  status text not null check (status in ('active','proposed')),
  manifest jsonb not null default '{}'::jsonb
);

create table public.user_modules (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id text not null references public.modules(id) on delete cascade,
  enabled boolean not null default true,
  thresholds jsonb,
  thresholds_source text not null default 'default' check (thresholds_source in ('default','ficha','manual')),
  confirmed boolean not null default false,
  primary key (user_id, module_id)
);

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id text not null references public.modules(id),
  metric text not null,
  value numeric not null,
  unit text,
  ts timestamptz not null default now(),
  source text not null default 'simulator' check (source in ('simulator','scenario','manual','device')),
  reading_group uuid,
  metadata jsonb not null default '{}'::jsonb
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reading_id uuid references public.readings(id) on delete set null,
  module_id text not null references public.modules(id),
  metric text not null,
  value numeric,
  level text not null check (level in ('warn','critical')),
  message text not null,
  explanation text,
  status text not null default 'open' check (status in ('open','ack','escalated')),
  ack_at timestamptz,
  ts timestamptz not null default now()
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.emergency_contacts(id) on delete cascade,
  channel text not null default 'whatsapp_sim' check (channel in ('whatsapp_sim')),
  body text not null,
  ts timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id text references public.modules(id),
  description text not null,
  target jsonb
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text,
  metadata jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create index readings_user_module_metric_ts_idx on public.readings (user_id, module_id, metric, ts desc);
create index alerts_user_ts_idx on public.alerts (user_id, ts desc);
create index outbound_messages_ts_idx on public.outbound_messages (ts desc);
create index emergency_contacts_user_idx on public.emergency_contacts (user_id);
create index medical_records_user_idx on public.medical_records (user_id);
create index conditions_user_idx on public.conditions (user_id);
create index medications_user_idx on public.medications (user_id);
create index user_modules_module_idx on public.user_modules (module_id);
create index readings_module_idx on public.readings (module_id);
create index alerts_module_idx on public.alerts (module_id);
create index alerts_reading_idx on public.alerts (reading_id);
create index outbound_messages_alert_idx on public.outbound_messages (alert_id);
create index outbound_messages_user_idx on public.outbound_messages (user_id);
create index outbound_messages_contact_idx on public.outbound_messages (contact_id);
create index goals_user_idx on public.goals (user_id);
create index goals_module_idx on public.goals (module_id);
create index chat_messages_user_ts_idx on public.chat_messages (user_id, ts);
