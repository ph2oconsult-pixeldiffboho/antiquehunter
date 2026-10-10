/** Build-time app version (injected by Vite from Vercel env / build clock). */

export interface AppVersionInfo {
  /** Calendar version, e.g. 2026.10.10 */
  version: string;
  /** Short git SHA, or "dev" locally */
  sha: string;
  /** ISO timestamp of the build (UTC) */
  deployedAtIso: string;
}

export function getAppVersion(): AppVersionInfo {
  const version =
    typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
      ? __APP_VERSION__
      : 'dev';
  const sha =
    typeof __APP_BUILD_SHA__ !== 'undefined' && __APP_BUILD_SHA__
      ? __APP_BUILD_SHA__
      : 'dev';
  const deployedAtIso =
    typeof __APP_DEPLOYED_AT__ !== 'undefined' && __APP_DEPLOYED_AT__
      ? __APP_DEPLOYED_AT__
      : new Date().toISOString();
  return { version, sha, deployedAtIso };
}

/** Format the deploy time in Europe/Paris for display. */
export function formatDeployedWhen(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const locale = lang.startsWith('fr') ? 'fr-FR' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Full line for footer / clipboard, localized. */
export function formatVersionLine(lang: string): string {
  const { version, sha, deployedAtIso } = getAppVersion();
  const when = formatDeployedWhen(deployedAtIso, lang);
  if (lang.startsWith('fr')) {
    return `Version ${version} · build ${sha} · déployée le ${when}`;
  }
  return `Version ${version} · build ${sha} · deployed ${when}`;
}
