# YT Zero Enhance

Rozszerzenie dla Chromium, Firefoksa oraz Safari na macOS/iOS/iPadOS, które łączy zwykłe linki YouTube z lokalną instancją [YT Zero](https://github.com/Pelski/ytzero) i uzupełnia ograniczenia cross-origin embedded YouTube Playera.

Interfejs używa oficjalnej identyfikacji YT Zero: oryginalnego niebieskiego znaku Play, kroju Roboto, tokenów powierzchni `#0f0f0f` / `#1f1f1f` / `#272727`, akcentu `#3ea6ff` oraz czerwieni playera `#f2293a`. Popup, ustawienia, ikony instalacyjne i kontrolki embedded playera są wizualnie zgodne z aplikacją bazową.

## Funkcje

- opcjonalne przekierowanie `youtube.com/watch`, `/shorts`, `/live` i `youtu.be` do lokalnego `/watch/:videoId`, z zachowaniem timestampu;
- obsługa lokalnej instancji na `localhost`, w LAN, przez HTTPS i pod ścieżką reverse proxy;
- parowanie z zalogowaną stroną filmu i odczyt wersjonowanej konfiguracji osadzonej bezpiecznie w DOM;
- wiele sparowanych instancji YT Zero, z jedną domyślną dla przekierowań;
- interfejs angielski (domyślny), polski i niemiecki, wybierany automatycznie na podstawie języka interfejsu przeglądarki;
- oznaczenie działającego rozszerzenia w topbarze YT Zero przez `data-extension-status="active"` po zakończeniu inicjalizacji;
- synchronizacja ustawień profilu YT Zero: prędkości per kanał, seek, FPS, jakości, napisów, rozdziałów, SponsorBlock i nazw zrzutów;
- wybór najwyższej jakości dostępnej dla filmu, która nie przekracza progu ustawionego w aktywnym profilu (`auto` wybiera najwyższą dostępną);
- pasek zgodny z LocalPlayerem YT Zero: identyczny układ i rozmiary, buforowanie/postęp, rozdziały, segmenty SponsorBlock, tooltip czasu i rozdziału oraz zwijana głośność;
- skróty działające bez wcześniejszego fokusowania iframe;
- zrzut widocznej klatki embedded playera do PNG/JPEG/WebP z konfigurowalną nazwą;
- przybliżone przechodzenie klatka po klatce `,` / `.`, z automatycznym pomiarem odstępu klatek;
- PiP, fullscreen, tryb kinowy YT Zero, napisy, prędkość, głośność, przewijanie, automatyczne chowanie paska i kursora;
- twarde ukrywanie natywnego UI YouTube stylami wewnątrz iframe: reguła strukturalna zachowuje tylko obraz, napisy, loader i elementy reklamowe, więc działa także wtedy, gdy YouTube ignoruje `controls=0` lub podmienia klasy w eksperymencie A/B.

Rozszerzenie nie modyfikuje YT Zero ani jego bazy danych. Przełączniki samego dodatku są przechowywane przez `storage.sync`, a lista sparowanych instancji i ich ostatnia konfiguracja profilu przez `storage.local`.

## Instalacja deweloperska

Wymagany jest [Bun](https://bun.sh/).

```bash
bun test
bun run build
```

### Chrome, Chromium, Edge, Brave

1. Otwórz `chrome://extensions` (Edge: `edge://extensions`).
2. Włącz **Tryb dewelopera**.
3. Kliknij **Załaduj rozpakowane**.
4. Wskaż katalog `dist/chromium`.
5. Otwórz stronę dowolnego filmu w YT Zero, kliknij ikonę rozszerzenia i wybierz **Połącz tę kartę**.

### Firefox

1. Otwórz `about:debugging#/runtime/this-firefox`.
2. Kliknij **Load Temporary Add-on / Wczytaj tymczasowy dodatek**.
3. Wskaż `dist/firefox/manifest.json`.
4. Otwórz stronę dowolnego filmu w YT Zero, kliknij ikonę dodatku i wybierz **Połącz tę kartę**.

Instalacja tymczasowa Firefoksa znika po restarcie. Stała instalacja wymaga podpisania ZIP-a przez AMO albo użycia Firefox Developer Edition z odpowiednią polityką dodatków.

### Safari na macOS

Do szybkiego testu folderu web extension zbuduj `dist/safari`, a następnie użyj trybu deweloperskiego Safari. Gotowy projekt Apple znajduje się w `safari/YT Zero Enhance`. Można go odtworzyć od zera poleceniem:

```bash
bun run safari:project
open "safari/YT Zero Enhance/YT Zero Enhance.xcodeproj"
```

`safari:project` nadpisuje wygenerowany wrapper. Po ustawieniu Team/signingu używaj zwykłego `bun run build`, który synchronizuje tylko zasoby rozszerzenia i zachowuje konfigurację Xcode.

W Xcode wybierz schemat macOS i uruchom aplikację zawierającą rozszerzenie. Następnie włącz je w **Safari → Settings → Extensions** i nadaj dostęp do witryn.

### Safari na iPhone/iPad

1. Otwórz istniejący projekt `safari/YT Zero Enhance/YT Zero Enhance.xcodeproj`.
2. Ustaw własny **Team** oraz unikalny bundle identifier.
3. Wybierz schemat iOS, podłącz urządzenie albo wybierz simulator, następnie **Run**.
4. Na urządzeniu włącz dodatek w **Settings → Apps → Safari → Extensions → YT Zero Enhance**.
5. Nadaj dostęp do YouTube, domeny instancji YT Zero i stron, na których chcesz ulepszać embed.

Testowanie na fizycznym iPhonie/iPadzie wymaga członkostwa w Apple Developer Program. Do App Store wysyła się aplikację zawierającą Safari Web Extension, a nie sam ZIP.

## Użytkowanie

Po instalacji kliknij ikonę YT Zero Enhance. Popup pozwala bez opuszczania bieżącej strony:

- przy pierwszym uruchomieniu sparować rozszerzenie z otwartą, zalogowaną stroną filmu w YT Zero;
- włączyć lub wyłączyć automatyczne przekierowania;
- włączyć lub wyłączyć wszystkie ulepszenia embedded playera;
- wykonać zrzut aktywnego embedded playera;
- otworzyć lokalną instancję YT Zero;
- przejść do listy instancji i podglądu ustawień.

W ustawieniach zaawansowanych:

- zobaczysz wszystkie sparowane instancje i wybierzesz domyślną;
- ustawienia aktywnego profilu są pokazane wyłącznie do odczytu;
- przycisk **Zmień w YT Zero** otwiera właściwą zakładkę ustawień domyślnej instancji;
- usunięcie instancji usuwa zapisane połączenie i nie zmienia niczego na serwerze.

Żeby dodać następną instancję, otwórz w niej stronę filmu, kliknij ikonę rozszerzenia i wybierz **Połącz obecną kartę jako inną instancję**. Każda sparowana strona korzysta z ustawień własnego aktywnego profilu; tylko przekierowania YouTube używają instancji oznaczonej jako domyślna.

Skróty playera:

| Klawisz | Akcja |
|---|---|
| krótkie `Space` / `K` | odtwórz / pauza |
| przytrzymane `Space` | tymczasowo 2×; po puszczeniu wraca ustawiona prędkość |
| `J` / `L` | −10 s / +10 s |
| `←` / `→` | skok o skonfigurowaną liczbę sekund |
| `↑` / `↓`, `M` | głośność, wyciszenie |
| `C` | włącz / wyłącz napisy |
| `+` / `-` | zwiększ / zmniejsz rozmiar napisów |
| `0`–`9` | pozycja 0–90% |
| `,` / `.` | poprzednia / następna klatka (najlepsze przy pauzie) |
| `S` | zapisz klatkę |
| `F` | fullscreen |
| `T` | tryb kinowy na stronie YT Zero |
| `Alt+Shift+S` | zrzut aktywnego embedded playera |
| `Alt+Shift+Y` | globalnie włącz / wyłącz przekierowania |

## Zrzuty klatek — co trzeba skonfigurować

Najwyższą jakość i faktycznie surową klatkę daje lokalny player YT Zero, bo ma bezpośredni dostęp do własnego `<video>`. Włącz plugin yt-dlp, pobierz film, wybierz źródło **Local** i użyj `S`; format i szablon nazwy konfiguruje się w **YT Zero → Settings → Player**.

Dla embedded playera:

1. włącz **Wstrzykuj wygląd i funkcje YT Zero**;
2. pozwól rozszerzeniu działać na danej witrynie;
3. doprowadź film do wybranej klatki, najlepiej `,` / `.`, i pozostaw player widoczny;
4. naciśnij `S`, przycisk zrzutu albo `Alt+Shift+S`;
5. ustaw PNG dla bezstratnego zrzutu, JPEG dla mniejszego pliku albo WebP w ustawieniach YT Zero; osadzona konfiguracja przekazuje wybór rozszerzeniu.

Embedded YouTube jest cross-origin, więc rozszerzenie przechwytuje wyrenderowaną kartę i kadruje sam obraz `<video>`. Wynik ma rozdzielczość ekranową, a nie źródłową. Inne okno zasłaniające przeglądarkę, sprzętowa nakładka wideo, DRM lub polityka systemu mogą dać czarną klatkę. W takim przypadku użyj lokalnego playera; ewentualnie sprawdź fullscreen i wyłączenie akceleracji sprzętowej w przeglądarce.

## Pakiety do store'ów

```bash
bun run check
bun run package
```

Powstaną:

- `artifacts/ytzero-enhance-chromium-0.1.0.zip` — Chrome Web Store / Edge Add-ons;
- `artifacts/ytzero-enhance-firefox-0.1.0.zip` — Firefox Add-ons (AMO).
- `artifacts/ytzero-enhance-safari-0.1.0.zip` — źródłowy web extension dla konwertera/Xcode; publikacja mobilna odbywa się przez projekt aplikacji Apple.

Przed publikacją zmień wersję równocześnie w `package.json` i trzech plikach `manifests/*.json`, wykonaj checklistę z [dokumentacji publikacji](docs/store-release.md) i zweryfikuj zachowanie z [macierzą kompatybilności](docs/embedded-player-compatibility.md).

## Prywatność i uprawnienia

Rozszerzenie nie ma analityki, reklam ani zewnętrznego backendu. YouTube jest wymaganym hostem, a dostęp do samodzielnie hostowanej instancji jest opcjonalny i nadawany dopiero po wskazaniu jej adresu. Szczegóły i tekst do formularzy store: [docs/privacy.md](docs/privacy.md).

## Ograniczenia

- rozszerzenie nie omija logowania, blokad geograficznych, reklam, DRM ani kontroli botów YouTube;
- w LibreWolf brak/referrer może zablokować iframe zanim skrypt rozszerzenia dostanie player — nie osłabiamy globalnie ochrony prywatności;
- background playback i programowy fullscreen nadal zależą od systemu, przeglądarki oraz user activation; na iOS fullscreen korzysta z natywnego `webkitEnterFullscreen` jako fallback;
- krok klatkowy w filmach VFR jest najlepszym przybliżeniem; dokładny eksport klatki źródłowej wymaga lokalnego pliku;
- link do filmu dostępnego tylko dla zalogowanego użytkownika może zostać z powrotem przekierowany; `Alt+Shift+Y` tymczasowo wyłącza redirect.

## Rozwój

Kod źródłowy jest w `src/`, statyczne strony w `static/`, a manifesty przeglądarek w `manifests/`. `dist/` i ZIP-y są generowane. Testy jednostkowe pokrywają URL-e, konfigurację z DOM, wiele instancji, bridge, zabezpieczenia originu, skróty, frame stepping oraz zrzuty.
