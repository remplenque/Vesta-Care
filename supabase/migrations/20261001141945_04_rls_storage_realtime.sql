-- 04_rls_storage_realtime

alter table public.profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.medical_records enable row level security;
alter table public.conditions enable row level security;
alter table public.medications enable row level security;
alter table public.modules enable row level security;
alter table public.user_modules enable row level security;
alter table public.readings enable row level security;
alter table public.alerts enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.goals enable row level security;
alter table public.chat_messages enable row level security;

-- profiles: owner por id
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated using (id = (select auth.uid()));

-- Tablas con user_id: políticas owner generadas
do $$
declare
  t text;
begin
  foreach t in array array[
    'emergency_contacts','medical_records','conditions','medications','user_modules',
    'readings','alerts','outbound_messages','goals','chat_messages'
  ] loop
    execute format('create policy %1$s_select_own on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert_own on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update_own on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete_own on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- modules: catálogo público de solo lectura
create policy modules_select_all on public.modules for select to anon, authenticated using (true);

-- Storage: bucket privado para fichas médicas, carpeta {auth.uid()}/...
insert into storage.buckets (id, name, public)
values ('medical-records', 'medical-records', false)
on conflict (id) do nothing;

create policy medical_records_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'medical-records' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy medical_records_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'medical-records' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy medical_records_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'medical-records' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'medical-records' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy medical_records_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'medical-records' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Realtime
alter publication supabase_realtime add table public.readings, public.alerts, public.outbound_messages, public.user_modules;
