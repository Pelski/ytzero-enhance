import { DEFAULT_SETTINGS, normalizeSettings } from "./core";
import { hostPermissionPattern } from "./contract";
import { friendlyInstanceName, inferInstanceUrl, PairedInstance, parseEmbeddedConfigurationText } from "./instances";
import { localizeDocument, t } from "./i18n";
import { addApiListener, callApi, ext } from "./webext";

localizeDocument();

const onboarding = document.querySelector<HTMLElement>("#onboarding")!;
const connected = document.querySelector<HTMLElement>("#connected")!;
const stateDot = document.querySelector<HTMLElement>("#state")!;
const subtitle = document.querySelector<HTMLElement>("#subtitle")!;
const message = document.querySelector<HTMLOutputElement>("#message")!;
const onboardingMessage = document.querySelector<HTMLOutputElement>("#onboarding-message")!;
const redirect = document.querySelector<HTMLInputElement>('input[name="redirectEnabled"]')!;
const enhance = document.querySelector<HTMLInputElement>('input[name="enhancePlayer"]')!;
let defaultInstance: PairedInstance | null = null;

async function load() {
  const [stored, registry] = await Promise.all([
    callApi<any>(ext.storage.sync, "get", DEFAULT_SETTINGS),
    callApi<any>(ext.runtime, "sendMessage", { type: "ytze-list-instances" }).catch(() => ({ instances: [] })),
  ]);
  const settings = normalizeSettings(stored);
  defaultInstance = registry.instances?.find((item: PairedInstance) => item.url === registry.defaultUrl) ?? registry.instance ?? null;
  const paired = Boolean(defaultInstance);
  onboarding.hidden = paired;
  connected.hidden = !paired;
  stateDot.classList.toggle("on", paired && (settings.redirectEnabled || (settings.enhancePlayer && !defaultInstance!.blocked && defaultInstance!.configuration.enabled)));
  subtitle.textContent = paired ? defaultInstance!.name : t("connectYtZero");
  if (!paired) return;
  document.querySelector<HTMLElement>("#instance-name")!.textContent = defaultInstance!.name;
  document.querySelector<HTMLElement>("#instance-url")!.textContent = defaultInstance!.url;
  const sync = document.querySelector<HTMLElement>("#sync-status")!;
  sync.textContent = defaultInstance!.diagnostic || (defaultInstance!.configuration.enabled ? t("settingsSynced") : t("enhancementsDisabled"));
  sync.classList.toggle("off", !defaultInstance!.configuration.enabled || Boolean(defaultInstance!.diagnostic));
  redirect.checked = settings.redirectEnabled;
  enhance.checked = settings.enhancePlayer;
}

async function pairActiveTab(button: HTMLButtonElement, output: HTMLOutputElement) {
  button.disabled = true;
  output.className = "";
  output.textContent = t("findingSettings");
  try {
    const tabs = await callApi<any[]>(ext.tabs, "query", { active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.id == null || !tab.url) throw new Error(t("openPageFirst"));
    const results = await callApi<any[]>(ext.scripting, "executeScript", {
      target: { tabId: tab.id },
      func: () => ({
        configuration: document.body?.querySelector("#ytzero-enhance-configuration")?.textContent ?? "",
        appName: document.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.content ?? "",
        manifestUrl: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? "",
      }),
    });
    const raw = results?.[0]?.result?.configuration;
    if (!raw) throw new Error(t("settingsNotReady"));
    const validation = parseEmbeddedConfigurationText(raw);
    if (!validation.ok) throw new Error(validation.diagnostic);
    const instanceUrl = inferInstanceUrl(tab.url, results?.[0]?.result?.manifestUrl);
    if (!instanceUrl) throw new Error(t("openSpecificPage"));
    const permission = hostPermissionPattern(instanceUrl);
    if (permission && ext.permissions && !await callApi<boolean>(ext.permissions, "request", { origins: [permission] })) throw new Error(t("permissionNeeded"));
    const response = await callApi<any>(ext.runtime, "sendMessage", {
      type: "ytze-pair-instance",
      url: instanceUrl,
      name: friendlyInstanceName(results?.[0]?.result?.appName || "", instanceUrl),
      configuration: validation.value,
    });
    if (!response?.ok) throw new Error(response?.error || t("pairFailed"));
    output.textContent = t("pairedReloading");
    await callApi(ext.tabs, "reload", tab.id);
    await load();
  } catch (error: any) {
    output.textContent = error?.message || String(error);
    output.className = "error";
  } finally {
    button.disabled = false;
  }
}

for (const id of ["pair-first", "pair-another"]) {
  const button = document.querySelector<HTMLButtonElement>(`#${id}`)!;
  button.addEventListener("click", () => void pairActiveTab(button, id === "pair-first" ? onboardingMessage : message));
}

async function saveToggle(key: string, value: boolean) {
  await callApi(ext.storage.sync, "set", { [key]: value });
  message.textContent = t("saved");
  message.className = "";
  window.setTimeout(() => { message.textContent = ""; }, 1200);
  void load();
}

redirect.addEventListener("change", () => void saveToggle("redirectEnabled", redirect.checked));
enhance.addEventListener("change", () => void saveToggle("enhancePlayer", enhance.checked));

document.querySelector("#capture")?.addEventListener("click", async () => {
  message.textContent = t("capturing");
  const response = await callApi<any>(ext.runtime, "sendMessage", { type: "ytze-trigger-active-capture" }).catch((error) => ({ ok: false, error: error.message }));
  message.textContent = response?.ok ? t("frameSaved") : response?.error || t("noActivePlayer");
  message.className = response?.ok ? "" : "error";
});

document.querySelector("#open-instance")?.addEventListener("click", () => {
  if (defaultInstance) void callApi(ext.tabs, "create", { url: defaultInstance.url });
  window.close();
});

document.querySelector("#options")?.addEventListener("click", () => {
  void ext.runtime.openOptionsPage();
  window.close();
});

void load();
addApiListener(ext?.storage?.onChanged, () => void load());
