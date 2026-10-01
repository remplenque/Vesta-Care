-- 05_seed: catálogo de módulos (el usuario demo se crea con scripts/create-demo-user.sql)

insert into public.modules (id, status, manifest) values
('pillbox', 'active', jsonb_build_object(
  'id', 'pillbox', 'name', 'Pastillero inteligente', 'status', 'active',
  'conditions', jsonb_build_array('polifarmacia', 'hipertensión', 'diabetes tipo 2'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'dose_scheduled', 'unit', 'dosis', 'label', 'Dosis programada'),
    jsonb_build_object('key', 'dose_taken', 'unit', 'dosis', 'label', 'Dosis tomada'),
    jsonb_build_object('key', 'dose_missed', 'unit', 'dosis', 'label', 'Dosis omitida')
  ),
  'expectedFrequency', 'Según horario de cada medicamento (ej. 08:00 y 20:00)',
  'defaultThresholds', '{}'::jsonb,
  'goals', jsonb_build_array('Tomar al menos el 95% de las dosis a tiempo', 'Ninguna dosis con más de 30 min de atraso'),
  'agentContext', 'dose_scheduled marca la hora en que tocaba un medicamento y dose_taken cuándo se tomó realmente (metadata.medication_id indica cuál). Un atraso de más de 30 minutos es una señal suave; dose_missed significa que no se tomó y genera una alerta de atención. Pregunta con cariño, sin retar, y recuerda la próxima toma.'
)),
('bp', 'active', jsonb_build_object(
  'id', 'bp', 'name', 'Presión arterial', 'status', 'active',
  'conditions', jsonb_build_array('hipertensión'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'systolic', 'unit', 'mmHg', 'label', 'Presión sistólica'),
    jsonb_build_object('key', 'diastolic', 'unit', 'mmHg', 'label', 'Presión diastólica')
  ),
  'expectedFrequency', '2 veces al día (mañana y noche)',
  'defaultThresholds', '{"systolic":{"normal":[90,140],"margin":20},"diastolic":{"normal":[60,90],"margin":10}}'::jsonb,
  'goals', jsonb_build_array('Mantener la presión bajo 135/85 mmHg'),
  'agentContext', 'La presión se lee como sistólica/diastólica (ej. 120/80 mmHg). Sobre 140/90 es alta y sobre 160/100 es preocupante; con 180/110 o más hay que contactar a la familia o a urgencias, sobre todo si hay dolor de cabeza, pecho o mareo. Bajo 90/60 puede causar mareos y caídas.'
)),
('heart_rate', 'active', jsonb_build_object(
  'id', 'heart_rate', 'name', 'Frecuencia cardíaca', 'status', 'active',
  'conditions', jsonb_build_array('arritmia', 'hipertensión'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'bpm', 'unit', 'lpm', 'label', 'Frecuencia cardíaca')
  ),
  'expectedFrequency', 'Continua (cada 5–15 min desde el reloj)',
  'defaultThresholds', '{"bpm":{"normal":[55,100],"margin":10}}'::jsonb,
  'goals', jsonb_build_array('Frecuencia en reposo entre 60 y 90 lpm'),
  'agentContext', 'La frecuencia cardíaca normal en reposo es de 55 a 100 latidos por minuto. Valores muy bajos pueden causar mareos o desmayos, y muy altos en reposo pueden indicar arritmia, fiebre o deshidratación. Considera si la persona estaba haciendo actividad antes de alarmar.'
)),
('glucose', 'active', jsonb_build_object(
  'id', 'glucose', 'name', 'Glucosa', 'status', 'active',
  'conditions', jsonb_build_array('diabetes tipo 2'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'mg_dl', 'unit', 'mg/dL', 'label', 'Glucosa')
  ),
  'expectedFrequency', '4 veces al día (ayunas y después de comidas)',
  'defaultThresholds', '{"mg_dl":{"normal":[80,180],"margin":10}}'::jsonb,
  'goals', jsonb_build_array('Glucosa en ayunas entre 80 y 130 mg/dL', 'Después de comer bajo 180 mg/dL'),
  'agentContext', 'En ayunas lo ideal es 80–130 mg/dL y después de comer bajo 180 mg/dL. Bajo 70 es hipoglicemia: hay que comer algo dulce de inmediato y es más urgente que un valor alto. Sobre 250 de forma repetida requiere avisar al médico o la familia.'
)),
('fall_detection', 'proposed', jsonb_build_object(
  'id', 'fall_detection', 'name', 'Detección de caídas', 'status', 'proposed',
  'conditions', jsonb_build_array('riesgo de caídas', 'vive solo'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'fall_detected', 'unit', 'evento', 'label', 'Caída detectada'),
    jsonb_build_object('key', 'impact_g', 'unit', 'g', 'label', 'Fuerza del impacto')
  ),
  'expectedFrequency', 'Por evento',
  'defaultThresholds', '{"fall_detected":{"normal":[0,0],"margin":0}}'::jsonb,
  'goals', jsonb_build_array('Cero caídas sin respuesta en más de 2 minutos'),
  'agentContext', 'fall_detected = 1 indica una posible caída detectada por el reloj o sensor. Pregunta de inmediato si está bien; si no responde en pocos minutos, se avisa a la familia.'
)),
('spo2', 'proposed', jsonb_build_object(
  'id', 'spo2', 'name', 'Saturación de oxígeno', 'status', 'proposed',
  'conditions', jsonb_build_array('EPOC', 'insuficiencia cardíaca'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'spo2', 'unit', '%', 'label', 'Saturación de oxígeno')
  ),
  'expectedFrequency', '2–3 veces al día o continua',
  'defaultThresholds', '{"spo2":{"normal":[94,100],"margin":4}}'::jsonb,
  'goals', jsonb_build_array('Saturación sobre 94%'),
  'agentContext', 'La saturación normal es 94–100%. Entre 90 y 93% conviene reposar y volver a medir; bajo 90% es preocupante, especialmente con falta de aire.'
)),
('activity', 'proposed', jsonb_build_object(
  'id', 'activity', 'name', 'Actividad física', 'status', 'proposed',
  'conditions', jsonb_build_array('sedentarismo', 'diabetes tipo 2'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'steps', 'unit', 'pasos', 'label', 'Pasos'),
    jsonb_build_object('key', 'inactive_hours', 'unit', 'h', 'label', 'Horas sin movimiento')
  ),
  'expectedFrequency', 'Resumen diario + cada hora',
  'defaultThresholds', '{"inactive_hours":{"normal":[0,4],"margin":2}}'::jsonb,
  'goals', jsonb_build_array('Caminar 3.000 pasos al día'),
  'agentContext', 'Los pasos muestran cuánto se movió en el día; para esta edad 3.000–5.000 es una buena meta. Muchas horas sin movimiento durante el día pueden indicar que se siente mal o que tuvo un problema.'
)),
('sos', 'proposed', jsonb_build_object(
  'id', 'sos', 'name', 'Botón SOS', 'status', 'proposed',
  'conditions', jsonb_build_array('vive solo'),
  'metrics', jsonb_build_array(
    jsonb_build_object('key', 'sos_pressed', 'unit', 'evento', 'label', 'Botón SOS presionado')
  ),
  'expectedFrequency', 'Por evento',
  'defaultThresholds', '{"sos_pressed":{"normal":[0,0],"margin":0}}'::jsonb,
  'goals', jsonb_build_array('Respuesta de un familiar en menos de 5 minutos'),
  'agentContext', 'sos_pressed = 1 significa que la persona pidió ayuda explícitamente. Es siempre urgente: se avisa a la familia de inmediato y se le acompaña mientras llega la ayuda.'
));
