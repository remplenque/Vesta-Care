-- 08b: random() es double precision; ingest_reading espera numeric
create or replace function public.sim_open_session()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_persona text;
  v_alert uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select sp.persona into v_persona
  from public.sim_personas sp
  join auth.users u on lower(u.email) = lower(sp.email)
  where u.id = v_uid and sp.profile = 'unstable' and sp.active;
  if v_persona is null then
    return null;
  end if;

  -- Emergencia en curso sin responder: se vuelve a mostrar
  select a.id into v_alert from public.alerts a
  where a.user_id = v_uid and a.level = 'critical' and a.status <> 'ack' and a.ts > now() - interval '30 minutes'
  order by a.ts desc limit 1;
  if v_alert is not null then
    return v_alert;
  end if;

  -- Recién dijo "Estoy bien": no se encadena otra emergencia al volver al inicio
  if exists (select 1 from public.alerts a where a.user_id = v_uid and a.level = 'critical' and a.ack_at > now() - interval '2 minutes') then
    return null;
  end if;

  if not exists (select 1 from public.user_modules um where um.user_id = v_uid and um.module_id = 'glucose' and um.enabled and um.confirmed) then
    return null;
  end if;

  update public.sim_personas set emergency_since = now() where persona = v_persona;
  perform public.ingest_reading(v_uid, 'glucose', 'mg_dl', (52 + round(random() * 6))::numeric, 'mg/dL', 'simulator');
  if exists (select 1 from public.user_modules um where um.user_id = v_uid and um.module_id = 'heart_rate' and um.enabled) then
    perform public.ingest_reading(v_uid, 'heart_rate', 'bpm', (104 + round(random() * 5))::numeric, 'lpm', 'simulator');
  end if;

  select a.id into v_alert from public.alerts a
  where a.user_id = v_uid and a.level = 'critical' and a.status <> 'ack'
  order by a.ts desc limit 1;
  return v_alert;
end;
$$;
