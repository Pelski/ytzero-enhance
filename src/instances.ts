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

export function inferInstanceUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    const match = url.pathname.match(/^(.*?)\/watch\/[A-Za-z0-9_-]{11}\/?$/);
    if (!match) return null;
    url.pathname = match[1] || "/";
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
