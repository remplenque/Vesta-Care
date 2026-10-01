-- 08_device_simulator: simulador de dispositivos que corre siempre dentro de Supabase (pg_cron).
-- Mismas personas y rangos que el simulador de Vicente (src/lib/personas.ts, src/lib/simulator.ts);
-- la diferencia es que avanza cada 5 s sin depender de que el panel /demo esté abierto.
-- Todo entra por ingest_reading / ingest_bp con source 'simulator': las alertas las decide el motor.

create extension if not exists pg_cron;

create table if not exists public.sim_personas (
  persona text primary key,
  email text not null unique,
  profile text not null check (profile in ('stable', 'unstable', 'new')),
  active boolean not null default true,
  emergency_since timestamptz,          -- Rosa: emergencia en curso (se inicia al abrir la app)
  last_tick timestamptz
);
alter table public.sim_personas enable row level security;  -- sin políticas: solo funciones definer

insert into public.sim_personas (persona, email, profile) values
  ('luis', 'demo@vestacare.cl', 'stable'),
  ('rosa', 'rosa@vestacare.cl', 'unstable'),
  ('jorge', 'jorge@vestacare.cl', 'new')
on conflict (persona) do nothing;

-- Paseo aleatorio acotado: valores que cambian de a poco, como un sensor real
create or replace function public.sim_walk(p_last numeric, p_lo numeric, p_hi numeric, p_step numeric)
returns numeric
language sql
volatile
set search_path = ''
as $$
  select round(case
    when p_last is null or p_last < p_lo or p_last > p_hi then p_lo + random() * (p_hi - p_lo)
    else greatest(p_lo, least(p_hi, p_last + (random() * 2 - 1) * p_step))
  end);
$$;

create or replace function public.sim_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  m record;
  t text;
  v_uid uuid;
  v_tz text;
  v_now timestamptz := now();
  v_mods text[];
  v_last_ts timestamptz;
  v_last numeric;
  v_last2 numeric;
  v_emergency boolean;
  v_today date;
  v_at timestamptz;
  v_delay int;
  v_meta jsonb;
  hr_lo numeric; hr_hi numeric; gl_lo numeric; gl_hi numeric;
  sys_lo numeric; sys_hi numeric; dia_lo numeric; dia_hi numeric;
begin
  for p in
    select sp.persona, sp.profile, sp.emergency_since, u.id as user_id
    from public.sim_personas sp
    join auth.users u on lower(u.email) = lower(sp.email)
    where sp.active
  loop
    v_uid := p.user_id;
    select array_agg(um.module_id) into v_mods
    from public.user_modules um
    where um.user_id = v_uid and um.enabled and um.confirmed;
    -- Cuenta nueva: espera a que el onboarding confirme módulos
    if v_mods is null then
      continue;
    end if;
    select coalesce(pr.timezone, 'America/Santiago') into v_tz from public.profiles pr where pr.id = v_uid;

    -- Fin de la emergencia: la respondió ("Estoy bien"), pasaron 30 min o un reinicio borró su alerta
    if p.emergency_since is not null and (
      v_now - p.emergency_since > interval '30 minutes'
      or exists (
        select 1 from public.alerts a
        where a.user_id = v_uid and a.level = 'critical' and a.status = 'ack' and a.ts >= p.emergency_since - interval '5 seconds'
      )
      or (v_now - p.emergency_since > interval '1 minute' and not exists (
        select 1 from public.alerts a
        where a.user_id = v_uid and a.level = 'critical' and a.ts >= p.emergency_since - interval '5 seconds'
      ))
    ) then
      update public.sim_personas set emergency_since = null where persona = p.persona;
      p.emergency_since := null;
    end if;
    v_emergency := p.emergency_since is not null;

    -- Rangos de src/lib/simulator.ts (STABLE / UNSTABLE)
    if p.profile = 'unstable' then
      hr_lo := 70; hr_hi := 99; gl_lo := 85; gl_hi := 178; sys_lo := 128; sys_hi := 144; dia_lo := 78; dia_hi := 89;
    else
      hr_lo := 62; hr_hi := 82; gl_lo := 95; gl_hi := 140; sys_lo := 116; sys_hi := 132; dia_lo := 70; dia_hi := 82;
    end if;
    -- Emergencia: hipoglucemia (crítica) con el pulso acelerado (atención)
    if v_emergency then
      hr_lo := 102; hr_hi := 110; gl_lo := 52; gl_hi := 60;
    end if;

    -- Reloj: pulso cada tick (5 s)
    if 'heart_rate' = any(v_mods) then
      select r.value into v_last from public.readings r
      where r.user_id = v_uid and r.module_id = 'heart_rate' and r.metric = 'bpm'
      order by r.ts desc limit 1;
      perform public.ingest_reading(v_uid, 'heart_rate', 'bpm', public.sim_walk(v_last, hr_lo, hr_hi, 3), 'lpm', 'simulator');
    end if;

    -- Sensor de glucosa: cada 30 s
    if 'glucose' = any(v_mods) then
      v_last_ts := null; v_last := null;
      select r.ts, r.value into v_last_ts, v_last from public.readings r
      where r.user_id = v_uid and r.module_id = 'glucose' and r.metric = 'mg_dl'
      order by r.ts desc limit 1;
      if v_last_ts is null or v_now - v_last_ts >= interval '27 seconds' then
        perform public.ingest_reading(v_uid, 'glucose', 'mg_dl', public.sim_walk(v_last, gl_lo, gl_hi, 6), 'mg/dL', 'simulator');
      end if;
    end if;

    -- Tensiómetro: cada 60 s
    if 'bp' = any(v_mods) then
      v_last_ts := null; v_last := null; v_last2 := null;
      select r.ts, r.value into v_last_ts, v_last from public.readings r
      where r.user_id = v_uid and r.module_id = 'bp' and r.metric = 'systolic'
      order by r.ts desc limit 1;
      if v_last_ts is null or v_now - v_last_ts >= interval '57 seconds' then
        select r.value into v_last2 from public.readings r
        where r.user_id = v_uid and r.module_id = 'bp' and r.metric = 'diastolic'
        order by r.ts desc limit 1;
        perform public.ingest_bp(v_uid, public.sim_walk(v_last, sys_lo, sys_hi, 4), public.sim_walk(v_last2, dia_lo, dia_hi, 3), 'simulator');
      end if;
    end if;

    -- Pastillero: tomas de hoy en tiempo real. Estable: la toma 3–15 min tarde. Inestable: la olvida
    if 'pillbox' = any(v_mods) then
      v_today := (v_now at time zone v_tz)::date;
      for m in select md.id, md.schedule from public.medications md where md.user_id = v_uid loop
        for t in select jsonb_array_elements_text(coalesce(m.schedule->'times', '[]'::jsonb)) loop
          v_at := (v_today + t::time) at time zone v_tz;
          continue when v_at > v_now or v_now - v_at > interval '3 hours';
          v_meta := jsonb_build_object('medication_id', m.id, 'scheduled_for', v_at);

          if not exists (
            select 1 from public.readings r
            where r.user_id = v_uid and r.module_id = 'pillbox' and r.metric = 'dose_scheduled'
              and r.metadata->>'medication_id' = m.id::text and (r.metadata->>'scheduled_for')::timestamptz = v_at
          ) then
            perform public.ingest_reading(v_uid, 'pillbox', 'dose_scheduled', 1, 'dosis', 'simulator', null, v_meta, v_at);
          end if;

          continue when exists (
            select 1 from public.readings r
            where r.user_id = v_uid and r.module_id = 'pillbox' and r.metric in ('dose_taken', 'dose_missed')
              and r.metadata->>'medication_id' = m.id::text and (r.metadata->>'scheduled_for')::timestamptz = v_at
          );

          if p.profile = 'unstable' then
            if v_now - v_at > interval '30 minutes' then
              perform public.ingest_reading(v_uid, 'pillbox', 'dose_missed', 1, 'dosis', 'simulator', null, v_meta);
            end if;
          else
            v_delay := 3 + abs(hashtext(m.id::text || t || v_today::text)) % 13;
            if v_now >= v_at + make_interval(mins => v_delay) then
              perform public.ingest_reading(v_uid, 'pillbox', 'dose_taken', 1, 'dosis', 'simulator', null,
                v_meta || jsonb_build_object('delay_min', v_delay), v_at + make_interval(mins => v_delay));
            end if;
          end if;
        end loop;
      end loop;
    end if;

    update public.sim_personas set last_tick = v_now where persona = p.persona;
  end loop;
end;
$$;

-- Compacta lecturas simuladas de más de 30 min a una por hora y módulo: los gráficos de 7 días
-- siguen intactos y la app no carga miles de filas. Nunca borra lecturas ligadas a una alerta.
create or replace function public.sim_compact()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.readings r
  using (
    select x.id from (
      select rr.id, rr.ts, min(rr.ts) over (partition by rr.user_id, rr.module_id, date_trunc('hour', rr.ts)) as first_ts
      from public.readings rr
      where rr.source = 'simulator'
        and rr.module_id in ('heart_rate', 'glucose', 'bp')
        and rr.ts < now() - interval '30 minutes'
        and rr.ts > now() - interval '2 days'
    ) x
    where x.ts > x.first_ts
  ) d
  where r.id = d.id
    and not exists (select 1 from public.alerts a where a.reading_id = r.id)
    and not (r.reading_group is not null and exists (
      select 1 from public.alerts a join public.readings r2 on r2.id = a.reading_id
      where r2.reading_group = r.reading_group
    ));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Rosa: al abrir la app empieza una emergencia (o se reabre la que está en curso).
-- Devuelve el id de la alerta crítica para que la PWA la muestre; null para cualquier otra persona.
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
  perform public.ingest_reading(v_uid, 'glucose', 'mg_dl', 52 + round(random() * 6), 'mg/dL', 'simulator');
  if exists (select 1 from public.user_modules um where um.user_id = v_uid and um.module_id = 'heart_rate' and um.enabled) then
    perform public.ingest_reading(v_uid, 'heart_rate', 'bpm', 104 + round(random() * 5), 'lpm', 'simulator');
  end if;

  select a.id into v_alert from public.alerts a
  where a.user_id = v_uid and a.level = 'critical' and a.status <> 'ack'
  order by a.ts desc limit 1;
  return v_alert;
end;
$$;

-- Panel /demo: estado y pausa del simulador por persona.
-- DEUDA TÉCNICA (demo): abiertas a anon como el resto del panel; solo tocan a las tres personas.
create or replace function public.sim_status()
returns table (persona text, active boolean, emergency_since timestamptz, last_tick timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.persona, sp.active, sp.emergency_since, sp.last_tick from public.sim_personas sp order by sp.persona;
$$;

create or replace function public.sim_set_active(p_persona text, p_active boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sim_personas set active = p_active where persona = p_persona;
$$;

revoke execute on function public.sim_walk(numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.sim_tick() from public, anon, authenticated;
revoke execute on function public.sim_compact() from public, anon, authenticated;
revoke execute on function public.sim_open_session() from public, anon;
grant execute on function public.sim_open_session() to authenticated;
revoke execute on function public.sim_status() from public;
revoke execute on function public.sim_set_active(text, boolean) from public;
grant execute on function public.sim_status() to anon, authenticated;
grant execute on function public.sim_set_active(text, boolean) to anon, authenticated;

-- Reloj del simulador: cada 5 s. Compactación: cada 10 min
select cron.schedule('vesta-sim-tick', '5 seconds', 'select public.sim_tick()');
select cron.schedule('vesta-sim-compact', '*/10 * * * *', 'select public.sim_compact()');
