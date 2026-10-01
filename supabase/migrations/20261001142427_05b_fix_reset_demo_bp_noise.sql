-- 05b: random() dentro del VALUES lateral se evaluaba una sola vez (presión constante en el seed)

create or replace function public.reset_demo(p_mode text, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_tz text;
  v_losartan uuid;
  v_metformina uuid;
  v_ficha_thresholds_bp jsonb := '{"systolic":{"normal":[90,140],"margin":20},"diastolic":{"normal":[60,90],"margin":10}}';
  v_ficha_thresholds_glucose jsonb := '{"mg_dl":{"normal":[80,180],"margin":10}}';
begin
  if p_mode not in ('onboarding', 'full') then
    raise exception 'reset_demo: modo inválido %, usa onboarding | full', p_mode;
  end if;

  v_uid := coalesce(
    p_user_id,
    auth.uid(),
    (select p.id from public.profiles p where p.full_name = 'Luis Soto' order by p.created_at limit 1)
  );
  if v_uid is null then
    raise exception 'reset_demo: no se encontró el usuario demo';
  end if;
  if auth.uid() is not null and v_uid <> auth.uid() then
    raise exception 'reset_demo: solo puedes resetear tu propio usuario';
  end if;

  select coalesce(p.timezone, 'America/Santiago') into v_tz from public.profiles p where p.id = v_uid;

  delete from public.outbound_messages where user_id = v_uid;
  delete from public.alerts where user_id = v_uid;
  delete from public.readings where user_id = v_uid;
  delete from public.medical_records where user_id = v_uid;
  delete from public.conditions where user_id = v_uid;
  delete from public.medications where user_id = v_uid;
  delete from public.user_modules where user_id = v_uid;
  delete from public.goals where user_id = v_uid;
  delete from public.chat_messages where user_id = v_uid;

  if p_mode = 'onboarding' then
    return jsonb_build_object('mode', p_mode, 'user_id', v_uid);
  end if;

  insert into public.medical_records (user_id, file_path, extracted, confirmed)
  values (v_uid, null, jsonb_build_object(
    'conditions', jsonb_build_array('Hipertensión arterial', 'Diabetes tipo 2'),
    'medications', jsonb_build_array(
      jsonb_build_object('name', 'Losartán', 'dose', '50 mg', 'times', jsonb_build_array('08:00','20:00')),
      jsonb_build_object('name', 'Metformina', 'dose', '850 mg', 'times', jsonb_build_array('08:00','20:00'))
    ),
    'thresholds', jsonb_build_object('bp', v_ficha_thresholds_bp, 'glucose', v_ficha_thresholds_glucose)
  ), true);

  insert into public.conditions (user_id, name, source) values
    (v_uid, 'Hipertensión arterial', 'ficha'),
    (v_uid, 'Diabetes tipo 2', 'ficha');

  insert into public.medications (user_id, name, dose, schedule)
  values (v_uid, 'Losartán', '50 mg', '{"times":["08:00","20:00"]}')
  returning id into v_losartan;
  insert into public.medications (user_id, name, dose, schedule)
  values (v_uid, 'Metformina', '850 mg', '{"times":["08:00","20:00"]}')
  returning id into v_metformina;

  insert into public.user_modules (user_id, module_id, enabled, thresholds, thresholds_source, confirmed) values
    (v_uid, 'bp', true, v_ficha_thresholds_bp, 'ficha', true),
    (v_uid, 'glucose', true, v_ficha_thresholds_glucose, 'ficha', true),
    (v_uid, 'pillbox', true, null, 'ficha', true);

  -- Presión: 2/día (08:30 y 20:30); el ruido se calcula por fila en el subquery
  insert into public.readings (user_id, module_id, metric, value, unit, source, reading_group, ts)
  select v_uid, 'bp', x.metric, x.value, 'mmHg', 'simulator', s.grp, s.ts
  from (
    select gen_random_uuid() as grp,
           round(122 + random() * 14) as sys,
           round(72 + random() * 10) as dia,
           ((date_trunc('day', now() at time zone v_tz) - make_interval(days => d) + h) at time zone v_tz) as ts
    from generate_series(0, 6) d
    cross join unnest(array[interval '8 hours 30 minutes', interval '20 hours 30 minutes']) h
  ) s
  cross join lateral (values ('systolic', s.sys), ('diastolic', s.dia)) x(metric, value)
  where s.ts <= now();

  -- Glucosa: 4/día
  insert into public.readings (user_id, module_id, metric, value, unit, source, ts)
  select v_uid, 'glucose', 'mg_dl',
         case when h = interval '7 hours 30 minutes' then round(98 + random() * 25) else round(115 + random() * 45) end,
         'mg/dL', 'simulator', s.ts
  from (
    select h, ((date_trunc('day', now() at time zone v_tz) - make_interval(days => d) + h) at time zone v_tz) as ts
    from generate_series(0, 6) d
    cross join unnest(array[interval '7 hours 30 minutes', interval '12 hours 30 minutes',
                            interval '16 hours 30 minutes', interval '21 hours 30 minutes']) h
  ) s
  where s.ts <= now();

  -- Pastillero: dosis programadas y tomadas; 2 tomas atrasadas
  with slots as (
    select d, med_id, h,
           ((date_trunc('day', now() at time zone v_tz) - make_interval(days => d) + h) at time zone v_tz) as sched,
           case
             when d = 4 and h = interval '20 hours' and med_id = v_losartan then 95
             when d = 2 and h = interval '8 hours' and med_id = v_metformina then 70
             else 3 + floor(random() * 15)::int
           end as delay_min
    from generate_series(0, 6) d
    cross join unnest(array[v_losartan, v_metformina]) med_id
    cross join unnest(array[interval '8 hours', interval '20 hours']) h
  )
  insert into public.readings (user_id, module_id, metric, value, unit, source, metadata, ts)
  select v_uid, 'pillbox', e.metric, 1, 'dosis', 'simulator',
         jsonb_build_object('medication_id', s.med_id, 'scheduled_for', s.sched, 'delay_min', s.delay_min)
           || case when e.metric = 'dose_taken' and s.delay_min > 30 then '{"late":true}'::jsonb else '{}'::jsonb end,
         e.ts
  from slots s
  cross join lateral (values
    ('dose_scheduled', s.sched),
    ('dose_taken', s.sched + make_interval(mins => s.delay_min))
  ) e(metric, ts)
  where e.ts <= now();

  insert into public.goals (user_id, module_id, description, target) values
    (v_uid, 'bp', 'Mantener la presión bajo 135/85 mmHg', '{"systolic":{"max":135},"diastolic":{"max":85}}'),
    (v_uid, 'glucose', 'Glucosa en ayunas entre 80 y 130 mg/dL', '{"mg_dl":{"min":80,"max":130},"when":"fasting"}'),
    (v_uid, 'pillbox', 'Tomar al menos el 95% de las dosis a tiempo', '{"adherence":0.95,"max_delay_min":30}');

  return jsonb_build_object('mode', p_mode, 'user_id', v_uid);
end;
$$;
