import { configuredPageMatches, EnhanceConfiguration, validateEnhanceConfiguration } from "./contract";
import { t } from "./i18n";

export const PAIRED_INSTANCES_KEY = "ytzePairedInstances";
export const EMBEDDED_CONFIGURATION_ID = "ytzero-enhance-configuration";

export interface PairedInstance {
  url: string;
  name: string;
  configuration: EnhanceConfiguration;
  diagnostic?: string;
  blocked?: boolean;
  pairedAt: number;
  lastSeenAt: number;
}

export type PairedInstances = Record<string, PairedInstance>;

export function parseEmbeddedConfigurationText(value: string) {
  try { return validateEnhanceConfiguration(JSON.parse(value)); }
  catch { return { ok: false as const, diagnostic: t("embeddedSettingsReadFailed") }; }
}

export function inferInstanceUrl(pageUrl: string, applicationResourceUrl = ""): string | null {
  try {
    const url = new URL(pageUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (applicationResourceUrl) {
      const resource = new URL(applicationResourceUrl, url);
      if (resource.origin === url.origin && /^https?:$/.test(resource.protocol)) {
        const resourcePath = resource.pathname.match(/^(.*)\/(?:manifest\.webmanifest|favicon\.svg)$/);
        if (resourcePath) {
          url.pathname = resourcePath[1] || "/";
          url.search = "";
          url.hash = "";
          return url.toString().replace(/\/$/, "");
        }
      }
    }
    const pathname = url.pathname.replace(/\/+$/, "");
    const route = pathname.match(/^(.*)\/(?:search|discovery|shorts|live|watch|channel|subscriptions|playlists|playlist|followed-playlists|watchlist|downloads|liked|history|archive|cleanup|insights|settings|import|restore)(?:\/.*)?$/);
    // A path that does not end in a known application route is the homepage.
    // This also preserves an installation prefix such as /apps/ytzero.
    url.pathname = route ? route[1] || "/" : pathname || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

export function friendlyInstanceName(pageTitle: string, instanceUrl: string): string {
  const cleaned = pageTitle.replace(/\s*[—|·-]\s*YT Zero.*$/i, "").trim();
  if (cleaned && !/^(watch|ustawienia|settings)$/i.test(cleaned)) return cleaned.slice(0, 60);
  try { return new URL(instanceUrl).hostname; } catch { return "YT Zero"; }
}

export function pairedInstanceForPage(instances: PairedInstances, pageUrl: string): PairedInstance | null {
  return Object.values(instances)
    .filter((instance) => configuredPageMatches(pageUrl, instance.url))
    .sort((a, b) => b.url.length - a.url.length)[0] ?? null;
}

export function defaultPairedInstance(instances: PairedInstances, defaultUrl: string): PairedInstance | null {
  return instances[defaultUrl] ?? Object.values(instances).sort((a, b) => a.pairedAt - b.pairedAt)[0] ?? null;
}

export function instanceSettingsUrl(instanceUrl: string): string {
  const url = new URL(instanceUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/settings`.replace(/\/{2,}/g, "/");
  url.search = "?tab=display";
  url.hash = "";
  return url.toString();
}
