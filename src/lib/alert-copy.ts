import type { Alert } from "./data";
import type { Thresholds } from "./rules";

// Fixed safety copy shown with every alert. Mateo's own words go in alerts.explanation;
// these steps never change dose and always point to 131 (AGENTS.md §3.6).

export type AlertCopy = { title: string; explain: string; steps: string[] };

export function alertCopy(alert: Pick<Alert, "module_id" | "metric" | "value" | "level">, t: Thresholds): AlertCopy {
  const v = Number(alert.value);
  const urgent = alert.level === "critical";

  switch (alert.module_id) {
    case "bp": {
      const sys = t.systolic?.normal;
      const dia = t.diastolic?.normal;
      const low = sys ? v < sys[0] && alert.metric === "systolic" : false;
      if (low) {
        return {
          title: "Presión muy baja",
          explain: `Su presión está bajo su rango habitual (sobre ${sys![0]}/${dia?.[0] ?? 60}). Puede sentir mareo o debilidad.`,
          steps: ["Siéntese o recuéstese con las piernas en alto.", "Tome un vaso de agua.", "Si se desmaya o le cuesta hablar, llame al 131."],
        };
      }
      return {
        title: urgent ? "Crisis de presión" : "Presión alta",
        explain: urgent
          ? `Su presión está muy por sobre su rango habitual (bajo ${sys?.[1] ?? 140}/${dia?.[1] ?? 90}). Una presión así puede ser peligrosa si no se atiende pronto.`
          : `Su presión está algo por sobre su rango habitual (bajo ${sys?.[1] ?? 140}/${dia?.[1] ?? 90}).`,
        steps: urgent
          ? ["Siéntese y respire con calma.", "No tome pastillas extra por su cuenta.", "Si siente dolor de pecho, dolor de cabeza fuerte o le cuesta hablar, llame al 131."]
          : ["Siéntese y descanse 10 minutos.", "Vuelva a medirse.", "Si sigue alta o se siente mal, consulte a su médico."],
      };
    }
    case "glucose": {
      const n = t.mg_dl?.normal ?? [80, 180];
      if (v < n[0]) {
        return {
          title: urgent ? "Glucosa muy baja" : "Glucosa baja",
          explain: `Su azúcar en la sangre está bajo ${n[0]}. Puede sentir mareo, sudor o temblor.`,
          steps: [
            "Tome medio vaso de jugo o 3 cucharaditas de azúcar en agua.",
            "Siéntese y espere 15 minutos.",
            "Vuelva a medirse. Si se siente confundido, llame al 131.",
          ],
        };
      }
      return {
        title: urgent ? "Glucosa muy alta" : "Glucosa alta",
        explain: `Su azúcar en la sangre está sobre ${n[1]}.`,
        steps: ["Tome agua.", "Vuelva a medirse en una hora.", "Si sigue alta o tiene mucha sed y cansancio, consulte a su médico o llame al 131."],
      };
    }
    case "heart_rate": {
      const n = t.bpm?.normal ?? [55, 100];
      if (v < n[0]) {
        return {
          title: urgent ? "Pulso muy lento" : "Pulso lento",
          explain: `Su corazón late más lento de lo habitual (bajo ${n[0]} por minuto).`,
          steps: ["Siéntese o recuéstese.", "Si siente mareo, falta de aire o se desmaya, llame al 131."],
        };
      }
      return {
        title: urgent ? "Pulso muy rápido" : "Pulso rápido",
        explain: `Su corazón late rápido estando en reposo (sobre ${n[1]} por minuto).`,
        steps: [
          "Siéntese o recuéstese.",
          "Respire lento: inhale en 4 tiempos y exhale en 6.",
          "Si siente dolor de pecho, falta de aire o mareo, llame al 131.",
        ],
      };
    }
    case "pillbox":
      return {
        title: "Remedio sin registrar",
        explain: "Un remedio de hoy no quedó registrado. ¿Se lo tomó?",
        steps: ["Si ya se lo tomó, márquelo en el pastillero.", "Si no, revise con su médico si puede tomarlo ahora. No tome doble dosis."],
      };
    default:
      return { title: "Alerta", explain: alert.metric, steps: ["Si se siente mal, llame al 131."] };
  }
}
