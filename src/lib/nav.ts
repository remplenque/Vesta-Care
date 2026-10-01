// App structure: the companion screen (/mateo) is the real home of the app; /inicio is the
// information dashboard ("Resumen"); /calendario the week and month of activities; /modulos is
// where modules and display preferences are configured.
export const HOME_PATH = "/mateo";
export const DASHBOARD_PATH = "/inicio";
export const CALENDAR_PATH = "/calendario";
export const SETTINGS_PATH = "/modulos";

/** Screen of a module: the pillbox has its own, the vitals share /modulos/[id] */
export function moduleHref(moduleId: string) {
  return moduleId === "pillbox" ? "/pastillero" : `/modulos/${moduleId}`;
}
