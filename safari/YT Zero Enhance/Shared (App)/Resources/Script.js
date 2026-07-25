const copy = {
    en: {
        ios: "You can turn on YT Zero Enhance’s Safari extension in Settings.",
        unknownPreferences: "You can turn on YT Zero Enhance’s extension in Safari Extensions preferences.",
        onPreferences: "YT Zero Enhance’s extension is currently on. You can turn it off in Safari Extensions preferences.",
        offPreferences: "YT Zero Enhance’s extension is currently off. You can turn it on in Safari Extensions preferences.",
        openPreferences: "Quit and Open Safari Extensions Preferences…",
        unknownSettings: "You can turn on YT Zero Enhance’s extension in the Extensions section of Safari Settings.",
        onSettings: "YT Zero Enhance’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.",
        offSettings: "YT Zero Enhance’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.",
        openSettings: "Quit and Open Safari Settings…"
    },
    pl: {
        ios: "Rozszerzenie YT Zero Enhance dla Safari możesz włączyć w Ustawieniach.",
        unknownPreferences: "Rozszerzenie YT Zero Enhance możesz włączyć w preferencjach rozszerzeń Safari.",
        onPreferences: "Rozszerzenie YT Zero Enhance jest włączone. Możesz je wyłączyć w preferencjach rozszerzeń Safari.",
        offPreferences: "Rozszerzenie YT Zero Enhance jest wyłączone. Możesz je włączyć w preferencjach rozszerzeń Safari.",
        openPreferences: "Zakończ i otwórz preferencje rozszerzeń Safari…",
        unknownSettings: "Rozszerzenie YT Zero Enhance możesz włączyć w sekcji Rozszerzenia w ustawieniach Safari.",
        onSettings: "Rozszerzenie YT Zero Enhance jest włączone. Możesz je wyłączyć w sekcji Rozszerzenia w ustawieniach Safari.",
        offSettings: "Rozszerzenie YT Zero Enhance jest wyłączone. Możesz je włączyć w sekcji Rozszerzenia w ustawieniach Safari.",
        openSettings: "Zakończ i otwórz ustawienia Safari…"
    },
    de: {
        ios: "Die Safari-Erweiterung YT Zero Enhance kann in den Einstellungen aktiviert werden.",
        unknownPreferences: "YT Zero Enhance kann in den Safari-Erweiterungseinstellungen aktiviert werden.",
        onPreferences: "YT Zero Enhance ist derzeit aktiviert. Die Erweiterung kann in den Safari-Erweiterungseinstellungen deaktiviert werden.",
        offPreferences: "YT Zero Enhance ist derzeit deaktiviert. Die Erweiterung kann in den Safari-Erweiterungseinstellungen aktiviert werden.",
        openPreferences: "Beenden und Safari-Erweiterungseinstellungen öffnen…",
        unknownSettings: "YT Zero Enhance kann im Bereich „Erweiterungen“ der Safari-Einstellungen aktiviert werden.",
        onSettings: "YT Zero Enhance ist derzeit aktiviert. Die Erweiterung kann im Bereich „Erweiterungen“ der Safari-Einstellungen deaktiviert werden.",
        offSettings: "YT Zero Enhance ist derzeit deaktiviert. Die Erweiterung kann im Bereich „Erweiterungen“ der Safari-Einstellungen aktiviert werden.",
        openSettings: "Beenden und Safari-Einstellungen öffnen…"
    }
};

const language = /^pl\b/i.test(navigator.language) ? "pl" : /^de\b/i.test(navigator.language) ? "de" : "en";
const messages = copy[language];
document.documentElement.lang = language;

function applyCopy(useSettingsInsteadOfPreferences = false) {
    const keys = useSettingsInsteadOfPreferences
        ? { unknownPreferences: "unknownSettings", onPreferences: "onSettings", offPreferences: "offSettings", openPreferences: "openSettings" }
        : {};
    document.querySelectorAll("[data-copy]").forEach((element) => {
        const key = keys[element.dataset.copy] || element.dataset.copy;
        element.innerText = messages[key];
    });
}

applyCopy();

function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);
    applyCopy(useSettingsInsteadOfPreferences);

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
