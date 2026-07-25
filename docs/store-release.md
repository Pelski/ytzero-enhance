# Publikacja w store'ach

## Wspólna checklista

1. Zmień wersję w `package.json` oraz wszystkich plikach `manifests/*.json`.
2. Uruchom `bun run check` i ręczne scenariusze z `embedded-player-compatibility.md`.
3. Sparuj testową instancję z poziomu zalogowanej strony filmu i potwierdź odczyt konfiguracji z DOM.
4. Uruchom `bun run package`.
5. Rozpakuj wszystkie ZIP-y i sprawdź, że w paczce nie ma źródeł, sourcemap, danych testowych ani sekretów.
6. Przygotuj screenshoty ustawień oraz playera w rozmiarach wymaganych przez dany store.
7. Podaj publiczny adres `docs/privacy.md` jako politykę prywatności.
8. Wyjaśnij reviewerowi wymagane hosty osadzonego odtwarzacza i opcjonalny dostęp do sparowanej instancji tekstem z sekcji poniżej.

## Chrome Web Store / Edge Add-ons

Wyślij `ytzero-enhance-chromium-<version>.zip`. W deklaracji single purpose użyj: „Redirect supported video links to a user-configured self-hosted YT Zero instance and enhance embedded player controls.”

Uzasadnienie host permission: „The extension needs access to supported embed origins to enhance their controls. Access to HTTP/HTTPS pages is optional and requested only when the user pairs an authenticated self-hosted YT Zero page. It reads the safe configuration embedded in that page and locates the iframe for an explicitly requested screenshot. Data is processed locally and never transmitted.”

Nie deklaruj obchodzenia reklam, geoblokad ani logowania. Zrzuty opisuj jako capture of the rendered embedded video, nie source-frame extraction.

## Firefox Add-ons (AMO)

Wyślij `ytzero-enhance-firefox-<version>.zip`. AMO może poprosić również o źródła do reprodukcji builda; wtedy dołącz repozytorium bez `dist/` i instrukcję `bun run package`. Gecko ID jest stałe: `ytzero-enhance@pelski.dev` — zmień je przed pierwszą publikacją, jeżeli domena/identyfikator ma być inny, a później już go nie zmieniaj.

## Safari macOS oraz iOS/iPadOS

1. Użyj projektu `safari/YT Zero Enhance/YT Zero Enhance.xcodeproj`. `bun run safari:project` służy do odtworzenia wrappera od zera i nadpisuje jego konfigurację; zwykły `bun run build` aktualizuje zasoby bez ruszania Team/signingu.
2. Otwórz projekt i ustaw Apple Developer Team, podpisywanie, App Groups (jeżeli Xcode ich zażąda) oraz finalne bundle identifiers.
3. Zbuduj oba schematy, przetestuj macOS oraz fizyczny iPhone/iPad.
4. Przygotuj listing i politykę prywatności w App Store Connect.
5. Wykonaj Archive osobno dla właściwego destination i prześlij build przez Organizer.

Safari 17+ wymaga jawnej zgody użytkownika na dostęp do witryn. Na iOS zgoda jest zarządzana w ustawieniach Safari oraz w menu rozszerzeń. Zrzut embedded playera pozostaje funkcją best effort: jeśli iOS nie udostępni przechwycenia widocznej karty albo zabezpieczona warstwa wideo zwróci czerń, jedyną pewną ścieżką jest lokalny player YT Zero.

## Do uzupełnienia przez właściciela przed pierwszym wydaniem

- finalna licencja repozytorium;
- publiczny URL polityki prywatności i adres kontaktowy;
- nazwa wydawcy oraz grafiki promocyjne;
- test na fizycznym Androidzie/Firefox Android oraz iPhonie/iPadzie, jeśli mobilne platformy mają być oficjalnie wspierane;
- podpisanie dodatku Firefox i weryfikacja komunikatów store dotyczących opcjonalnych host permissions.
