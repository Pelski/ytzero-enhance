# Privacy policy

Effective date: July 26, 2026

YT Zero Enhance does not collect, transmit to the developer, sell, share, or monetize personal data. The extension contains no analytics, advertising, telemetry, tracking, external backend, or remotely hosted executable code.

## Data stored by the extension

The extension stores only the information needed to provide its features:

- extension preferences and the default instance address in browser-managed `storage.sync`;
- connected instance addresses and the last valid player configuration in browser-managed `storage.local`.

This information remains under the browser's control. Depending on the user's browser-account settings, values in `storage.sync` may be synchronized between their devices by the browser vendor. The extension developer cannot access this information.

The player configuration contains presentation preferences such as playback speed, captions, quality, shortcuts, and screenshot settings. It does not contain profile identity, credentials, authentication secrets, private viewing history, or account data.

## Frame capture

When the user explicitly requests a frame capture, the browser creates an image of the visible tab. The extension crops that image locally in memory, starts a local file download, and releases the temporary image. Captures are never uploaded or transmitted.

## Network access

The extension communicates only with:

- the self-hosted YT Zero instance selected and connected by the user;
- supported player hosts as part of a page or embedded player opened by the user.

It does not send usage information, diagnostics, browsing history, player activity, or captured images to the developer or any analytics service.

## Permissions

- `storage` saves extension preferences and connected instances.
- `webNavigation` recognizes supported video links selected by the user.
- `activeTab` performs a user-requested action in the active tab.
- Required player-host access provides enhanced controls inside supported embedded players.
- Optional HTTP/HTTPS host access is requested only for an instance explicitly connected by the user. It is used to read the safe configuration exposed by that instance and locate its embedded player.

## Changes and contact

Any material change to this policy will be published in this repository before it is included in a release. Source code and issue tracking are available at [Pelski/ytzero-enhance](https://github.com/Pelski/ytzero-enhance). The main project is available at [Pelski/ytzero](https://github.com/Pelski/ytzero).

---

# Polityka prywatności

Data obowiązywania: 26 lipca 2026 r.

YT Zero Enhance nie zbiera, nie przesyła deweloperowi, nie sprzedaje, nie udostępnia ani nie monetyzuje danych osobowych. Rozszerzenie nie zawiera analityki, reklam, telemetrii, mechanizmów śledzących, zewnętrznego backendu ani zdalnie ładowanego kodu wykonywalnego.

## Dane przechowywane przez rozszerzenie

Rozszerzenie zapisuje wyłącznie informacje potrzebne do działania:

- ustawienia rozszerzenia i adres domyślnej instancji w zarządzanym przez przeglądarkę `storage.sync`;
- adresy połączonych instancji oraz ostatnią poprawną konfigurację odtwarzacza w zarządzanym przez przeglądarkę `storage.local`.

Informacje pozostają pod kontrolą przeglądarki. Zależnie od ustawień konta przeglądarki wartości z `storage.sync` mogą być synchronizowane między urządzeniami przez dostawcę przeglądarki. Deweloper rozszerzenia nie ma do nich dostępu.

Konfiguracja odtwarzacza zawiera preferencje prezentacji, takie jak prędkość odtwarzania, napisy, jakość, skróty i ustawienia zrzutów. Nie zawiera tożsamości profilu, danych logowania, sekretów uwierzytelniających, prywatnej historii oglądania ani danych konta.

## Zrzuty klatek

Gdy użytkownik wyraźnie zażąda zrzutu klatki, przeglądarka tworzy obraz widocznej karty. Rozszerzenie kadruje go lokalnie w pamięci, rozpoczyna pobieranie pliku i zwalnia obraz tymczasowy. Zrzuty nigdy nie są wysyłane ani przesyłane.

## Dostęp sieciowy

Rozszerzenie komunikuje się wyłącznie z:

- samodzielnie hostowaną instancją YT Zero wybraną i połączoną przez użytkownika;
- obsługiwanymi hostami odtwarzacza jako częścią strony lub osadzonego playera otwartego przez użytkownika.

Nie wysyła deweloperowi ani usługom analitycznym informacji o użyciu, diagnostyki, historii przeglądania, aktywności odtwarzacza ani zapisanych obrazów.

## Uprawnienia

- `storage` zapisuje ustawienia rozszerzenia i połączone instancje.
- `webNavigation` rozpoznaje obsługiwane linki do filmów wybrane przez użytkownika.
- `activeTab` wykonuje działanie zlecone przez użytkownika na aktywnej karcie.
- Wymagany dostęp do hostów odtwarzacza zapewnia ulepszone kontrolki w obsługiwanych osadzonych playerach.
- Opcjonalny dostęp do hostów HTTP/HTTPS jest wymagany dopiero dla instancji wyraźnie połączonej przez użytkownika. Służy do odczytu bezpiecznej konfiguracji udostępnionej przez tę instancję i odnalezienia jej osadzonego playera.

## Zmiany i kontakt

Każda istotna zmiana tej polityki zostanie opublikowana w repozytorium przed uwzględnieniem jej w wydaniu. Kod źródłowy i zgłoszenia są dostępne w [Pelski/ytzero-enhance](https://github.com/Pelski/ytzero-enhance). Główny projekt znajduje się w [Pelski/ytzero](https://github.com/Pelski/ytzero).
