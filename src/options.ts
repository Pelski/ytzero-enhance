import { EnhanceConfiguration } from "./contract";
import { instanceSettingsUrl, PairedInstance } from "./instances";
import { localizeDocument, t } from "./i18n";
import { addApiListener, callApi, ext } from "./webext";

localizeDocument();
document.title = `${t("extensionName")} — ${t("instancesAndSettings")}`;

const empty = document.querySelector<HTMLElement>("#empty")!;
const content = document.querySelector<HTMLElement>("#content")!;
const instancesRoot = document.querySelector<HTMLElement>("#instances")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
let instances: PairedInstance[] = [];
let defaultInstance: PairedInstance | null = null;

const yesNo = (value: boolean) => value ? t("enabled") : t("disabled");

function setText(id: string, value: string) {
  document.querySelector<HTMLElement>(`#${id}`)!.textContent = value;
}

function renderConfiguration(config: EnhanceConfiguration) {
  setText("cfg-enabled", yesNo(config.enabled));
  setText("cfg-controls", yesNo(config.player.replaceControls));
  setText("cfg-quality", config.player.preferredQuality === "auto" ? t("automatic") : config.player.preferredQuality);
  setText("cfg-speed", `${config.player.defaultPlaybackRate}×`);
  setText("cfg-seek", `${config.player.keyboardSeekSeconds} ${t("seconds")}`);
  setText("cfg-frame", `${config.player.frameStepFps} FPS`);
  setText("cfg-captions", config.player.captions.enabledByDefault ? `${t("enabled")} · ${config.player.captions.language.toUpperCase()}` : t("disabledByDefault"));
  const screenshotQuality = config.screenshots.format === "png" ? "" : ` · ${Math.round(config.screenshots.jpegQuality * 100)}%`;
  setText("cfg-screenshot", `${config.screenshots.format.toUpperCase()}${screenshotQuality}`);
  const categoryCount = config.sponsorBlock.categories.length;
  const categoryLabel = categoryCount === 1 ? t("category") : t("categories");
  setText("cfg-sponsor", config.sponsorBlock.enabled ? `${categoryCount} ${categoryLabel}` : t("disabled"));
}

function instanceCard(instance: PairedInstance, isDefault: boolean) {
  const card = document.createElement("article");
  card.className = "instance";
  card.dataset.url = instance.url;
  const main = document.createElement("div");
  main.className = "instance-main";
  const icon = document.createElement("span");
  icon.className = "instance-icon";
  icon.textContent = "▶";
  const copy = document.createElement("div");
  copy.className = "instance-copy";
  const name = document.createElement("div");
  name.className = "instance-name";
  name.append(document.createTextNode(instance.name));
  if (isDefault) { const badge = document.createElement("span"); badge.className = "badge"; badge.textContent = t("defaultBadge"); name.append(badge); }
  const url = document.createElement("span");
  url.className = "instance-url";
  url.textContent = instance.url;
  copy.append(name, url);
  main.append(icon, copy);
  const actions = document.createElement("div");
  actions.className = "instance-actions";
  const open = document.createElement("button");
  open.type = "button"; open.className = "secondary"; open.dataset.action = "open"; open.textContent = t("open");
  actions.append(open);
  if (!isDefault) { const makeDefault = document.createElement("button"); makeDefault.type = "button"; makeDefault.className = "ghost"; makeDefault.dataset.action = "default"; makeDefault.textContent = t("makeDefault"); actions.append(makeDefault); }
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "ghost danger"; remove.dataset.action = "remove"; remove.textContent = t("remove");
  actions.append(remove);
  card.append(main, actions);
  return card;
}

async function load() {
  const state = await callApi<any>(ext.runtime, "sendMessage", { type: "ytze-list-instances" }).catch(() => ({ instances: [] }));
  instances = state.instances ?? [];
  defaultInstance = instances.find((item) => item.url === state.defaultUrl) ?? state.instance ?? null;
  empty.hidden = instances.length > 0;
  content.hidden = instances.length === 0;
  instancesRoot.replaceChildren(...instances.map((instance) => instanceCard(instance, instance.url === defaultInstance?.url)));
  if (defaultInstance) {
    setText("settings-title", `${t("settings")} · ${defaultInstance.name}`);
    renderConfiguration(defaultInstance.configuration);
    const note = document.querySelector<HTMLElement>(".readonly-note")!;
    note.textContent = defaultInstance.diagnostic || `✓ ${t("readonlyNote")}`;
    note.classList.toggle("error", Boolean(defaultInstance.diagnostic));
  }
}

instancesRoot.addEventListener("click", async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
  const card = button?.closest<HTMLElement>(".instance");
  const url = card?.dataset.url;
  if (!button || !url) return;
  status.textContent = "";
  if (button.dataset.action === "open") { void callApi(ext.tabs, "create", { url }); return; }
  if (button.dataset.action === "default") {
    const result = await callApi<any>(ext.runtime, "sendMessage", { type: "ytze-set-default-instance", url });
    status.textContent = result?.ok ? t("defaultChanged") : result?.error;
    status.className = result?.ok ? "" : "error";
    await load();
  }
  if (button.dataset.action === "remove") {
    const instance = instances.find((item) => item.url === url);
    if (!window.confirm(`${t("removeConnection")} “${instance?.name || url}”?`)) return;
    const result = await callApi<any>(ext.runtime, "sendMessage", { type: "ytze-remove-instance", url });
    status.textContent = result?.ok ? t("instanceRemoved") : result?.error;
    status.className = result?.ok ? "" : "error";
    await load();
  }
});

document.querySelector("#open-settings")?.addEventListener("click", () => {
  if (defaultInstance) void callApi(ext.tabs, "create", { url: instanceSettingsUrl(defaultInstance.url) });
});

void load();
addApiListener(ext?.storage?.onChanged, () => void load());
