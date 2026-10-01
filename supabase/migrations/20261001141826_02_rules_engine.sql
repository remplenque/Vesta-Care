-- 02_rules_engine: motor de reglas determinista
-- Umbrales por métrica: { "normal": [min, max], "margin": n }
--   dentro de normal -> ok · fuera y distancia <= margin -> warn · más allá -> critical

create or replace function public.evaluate_level(value numeric, thresholds jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_min numeric;
  v_max numeric;
  v_margin numeric;
  v_dist numeric;
begin
  if value is null or thresholds is null or thresholds->'normal' is null then
    return 'ok';
  end if;
  v_min := (thresholds->'normal'->>0)::numeric;
  v_max := (thresholds->'normal'->>1)::numeric;
  v_margin := coalesce((thresholds->>'margin')::numeric, 0);

  if (v_min is null or value >= v_min) and (v_max is null or value <= v_max) then
    return 'ok';
  end if;

  v_dist := case when v_min is not null and value < v_min then v_min - value else value - v_max end;
  if v_dist <= v_margin then
    return 'warn';
  end if;
  return 'critical';
end;
$$;

create or replace function public.process_reading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thresholds jsonb;
  v_manifest jsonb;
  v_level text;
  v_rank int;
  v_label text;
  v_unit text;
  v_value_txt text;
  v_other numeric;
  v_message text;
  v_alert_id uuid;
  v_full_name text;
  v_med_name text;
  c record;
begin
  -- Pastillero: dosis programadas/tomadas no se evalúan
  if new.metric in ('dose_taken', 'dose_scheduled') then
    return new;
  end if;

  select m.manifest into v_manifest from public.modules m where m.id = new.module_id;

  if new.metric = 'dose_missed' then
    v_level := 'warn';
    if new.metadata ? 'medication_id' then
      select md.name || coalesce(' ' || md.dose, '') into v_med_name
      from public.medications md
      where md.id::text = new.metadata->>'medication_id';
    end if;
    v_message := 'Dosis omitida' || coalesce(': ' || v_med_name, '') || ' — no se registró la toma';
  else
    select um.thresholds->new.metric into v_thresholds
    from public.user_modules um
    where um.user_id = new.user_id and um.module_id = new.module_id;

    if v_thresholds is null then
      v_thresholds := v_manifest->'defaultThresholds'->new.metric;
    end if;

    v_level := public.evaluate_level(new.value, v_thresholds);
    if v_level = 'ok' then
      return new;
    end if;
  end if;

  v_rank := case v_level when 'critical' then 2 else 1 end;

  -- Cooldown 10 min por usuario + módulo; solo pasa si escala de nivel
  if exists (
    select 1 from public.alerts a
    where a.user_id = new.user_id
      and a.module_id = new.module_id
      and a.ts > now() - interval '10 minutes'
      and (case a.level when 'critical' then 2 else 1 end) >= v_rank
  ) then
    return new;
  end if;

  if v_message is null then
    select x->>'label', x->>'unit' into v_label, v_unit
    from jsonb_array_elements(coalesce(v_manifest->'metrics', '[]'::jsonb)) x
    where x->>'key' = new.metric
    limit 1;

    v_unit := coalesce(new.unit, v_unit, '');
    v_value_txt := trim_scale(new.value)::text;

    -- Presión: mostrar sistólica/diastólica si existe la otra del mismo grupo
    if new.module_id = 'bp' and new.reading_group is not null then
      select r.value into v_other
      from public.readings r
      where r.reading_group = new.reading_group and r.id <> new.id
        and r.metric in ('systolic', 'diastolic')
      limit 1;
      if v_other is not null then
        v_label := 'Presión arterial';
        v_value_txt := case when new.metric = 'systolic'
          then trim_scale(new.value)::text || '/' || trim_scale(v_other)::text
          else trim_scale(v_other)::text || '/' || trim_scale(new.value)::text end;
      end if;
    end if;
    if new.module_id = 'bp' and v_label is null then
      v_label := 'Presión arterial';
    end if;

    v_message := coalesce(v_label, v_manifest->>'name', new.metric) || ' ' || v_value_txt
      || case when v_unit <> '' then ' ' || v_unit else '' end
      || case v_level when 'critical' then ' — fuera de rango crítico' else ' — fuera de rango' end;
  end if;

  insert into public.alerts (user_id, reading_id, module_id, metric, value, level, message)
  values (new.user_id, new.id, new.module_id, new.metric, new.value, v_level, v_message)
  returning id into v_alert_id;

  if v_level = 'critical' then
    select p.full_name into v_full_name from public.profiles p where p.id = new.user_id;
    for c in
      select ec.id, ec.access_token from public.emergency_contacts ec where ec.user_id = new.user_id
    loop
      insert into public.outbound_messages (alert_id, user_id, contact_id, body)
      values (
        v_alert_id, new.user_id, c.id,
        '🚨 Vesta Care: ' || coalesce(v_full_name, 'tu familiar') || ' registró '
          || lower(left(v_message, 1)) || substr(v_message, 2)
          || '. Revisa su estado: /c/' || c.access_token::text
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function public.process_reading() from public, anon, authenticated;

create trigger readings_process_reading
  after insert on public.readings
  for each row execute function public.process_reading();
