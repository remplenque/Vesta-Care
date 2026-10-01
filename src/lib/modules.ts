// Presentation data per module. Names, metrics and thresholds come from modules.manifest;
// this file only adds what the manifest does not carry (icon, chart scale, device label).

export type ModuleUi = {
  icon: string;
  name: string;
  short: string;
  blurb: string;
  device?: string;
  primaryMetric?: string;
  unit?: string;
  scale?: [number, number]; // range shown on the bar and chart
};

export const MODULE_UI: Record<string, ModuleUi> = {
  bp: { icon: "blood_pressure", name: "Presión arterial", short: "Presión", blurb: "Presión arterial", device: "Reloj", primaryMetric: "systolic", unit: "mmHg", scale: [80, 200] },
  glucose: { icon: "glucose", name: "Glucosa", short: "Glucosa", blurb: "Azúcar en la sangre", device: "Sensor", primaryMetric: "mg_dl", unit: "mg/dL", scale: [40, 260] },
  heart_rate: { icon: "cardiology", name: "Frecuencia cardíaca", short: "Pulso", blurb: "Pulso en reposo", device: "Reloj", primaryMetric: "bpm", unit: "lpm", scale: [30, 160] },
  pillbox: { icon: "medication", name: "Pastillero", short: "Pastillero", blurb: "Sus remedios del día", device: "Pastillero" },
  fall_detection: { icon: "elderly", name: "Detección de caídas", short: "Caídas", blurb: "Aviso si se cae" },
  spo2: { icon: "spo2", name: "Oxígeno (SpO₂)", short: "Oxígeno", blurb: "Oxígeno en la sangre" },
  activity: { icon: "directions_walk", name: "Actividad física", short: "Actividad", blurb: "Pasos y caminatas" },
  sos: { icon: "sos", name: "Botón SOS", short: "SOS", blurb: "Pedir ayuda con un toque" },
};

export const VITAL_MODULES = ["bp", "glucose", "heart_rate"];
export const MODULE_ORDER = ["bp", "glucose", "pillbox", "heart_rate", "fall_detection", "spo2", "activity", "sos"];

export function moduleUi(id: string): ModuleUi {
  return MODULE_UI[id] ?? { icon: "widgets", name: id, short: id, blurb: "" };
}

export function sortModules<T>(items: T[], getId: (t: T) => string) {
  const idx = (id: string) => {
    const i = MODULE_ORDER.indexOf(id);
    return i === -1 ? 99 : i;
  };
  return [...items].sort((a, b) => idx(getId(a)) - idx(getId(b)));
}
