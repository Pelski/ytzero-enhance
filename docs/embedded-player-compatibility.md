# Embedded player — audyt kompatybilności

Stan issue trackera sprawdzony 25 lipca 2026. Przejrzano wszystkie publiczne zgłoszenia repozytorium YT Zero; poniżej są te, które dotyczą różnicy między iframe YouTube a lokalnym playerem albo bezpośrednio wpływają na rozszerzenie.

| Issue | Problem iframe względem lokalnego | Obsługa w YT Zero Enhance |
|---|---|---|
| [#68](https://github.com/Pelski/ytzero/issues/68) | Brak `,` / `.` do przechodzenia po klatkach | Dodane; odstęp jest mierzony przez `requestVideoFrameCallback`, z konfigurowanym FPS jako fallback. VFR pozostaje przybliżeniem. |
| [#67](https://github.com/Pelski/ytzero/issues/67) | Brak surowego zrzutu klatki iframe | Dodany zrzut wyrenderowanej klatki przez `captureVisibleTab` i crop. Surowa rozdzielczość źródła nadal tylko w lokalnym `<video>`. |
| [#52](https://github.com/Pelski/ytzero/issues/52) | Kursor nie znika w fullscreen iframe | Rozszerzenie chowa własny pasek i kursor po 2,6 s od ostatniego ruchu podczas odtwarzania. |
| [#51](https://github.com/Pelski/ytzero/issues/51) | Klawiatura pozostawia kontrolki YouTube na ekranie | Własne kontrolki mają niezależny timer; natywny pasek może być ukryty. |
| [#37](https://github.com/Pelski/ytzero/issues/37) | PiP niewidoczny w menu kontekstowym iframe | Dodany bezpośredni przycisk `requestPictureInPicture`; zadziała, jeśli browser/OS zezwala. |
| [#27](https://github.com/Pelski/ytzero/issues/27) | Aplikacja nadrzędna nie może stylować cross-origin YouTube | Content script działa wewnątrz iframe i dodaje skin/pasek YT Zero. |
| [#25](https://github.com/Pelski/ytzero/issues/25) | Skróty nie działają przed fokusem iframe | Skróty są rejestrowane w ramce od razu po wykryciu `<video>`. |
| [#61](https://github.com/Pelski/ytzero/issues/61), [#55](https://github.com/Pelski/ytzero/issues/55) | Overlay „up next” aplikacji jest niewidoczny w natywnym fullscreen YouTube | Po `ended` rozszerzenie prosi stronę nadrzędną o wyjście z fullscreen. Autoplay/feed nadal realizuje YT Zero. |
| [#38](https://github.com/Pelski/ytzero/issues/38) | LibreWolf usuwa referrer i YouTube odrzuca embed | Nie naprawiamy kosztem globalnej prywatności. Whitelist/referrer w LibreWolf lub lokalny player. |
| [#22](https://github.com/Pelski/ytzero/issues/22) | „Sign in to confirm you're not a bot” | Poza zakresem rozszerzenia; zmiana IP/VPN, zalogowana sesja YouTube albo yt-dlp/local. |
| [#64](https://github.com/Pelski/ytzero/issues/64) | Background playback na Androidzie | Best effort przez istniejący Media Session YT Zero; rozszerzenie nie może obejść zawieszenia iframe przez OS. |
| [#23](https://github.com/Pelski/ytzero/issues/23) | Auto-fullscreen na iOS/Safari | Ograniczenie platformy; rozszerzenie nie tworzy user activation i nie omija polityki Apple. |
| [#8](https://github.com/Pelski/ytzero/issues/8) | Prędkość resetowana przez YouTube | Bridge przekazuje efektywną prędkość profilu/per-channel, a rozszerzenie przywraca ją po resecie playera. |
| [#60](https://github.com/Pelski/ytzero/issues/60), [#41](https://github.com/Pelski/ytzero/issues/41) | Lokalne/shareable linki | Redirect zamienia prywatne kliknięcia na `/watch/:id`; nie tworzy publicznego, anonimowego tokenu share — to wymaga bezpiecznej funkcji serwera. |
| [#15](https://github.com/Pelski/ytzero/issues/15) | Rozróżnialne tytuły kart | Naprawione w YT Zero; rozszerzenie używa tytułu i kanału jedynie do nazwy zrzutu. |

## Funkcje lokalnego playera, których rozszerzenie celowo nie emuluje

- bezpośredni eksport obrazu w `videoWidth × videoHeight`;
- lokalne napisy WebVTT; rozmiar, kolor i tło napisów YouTube są synchronizowane przez bridge;
- opisy rozdziałów w osobnym panelu; na osi rozszerzenie pokazuje ticki rozdziałów oraz segmenty SponsorBlock;
- gwarantowane programowe sterowanie jakością strumienia; rozszerzenie przekazuje `vq` i ponawia wybór najwyższego poziomu do progu profilu przez wewnętrzny player, ale YouTube oficjalnie pozostawia jakość algorytmowi adaptacyjnemu i może zmienić ten mechanizm;
- działanie offline oraz seek po lokalnym pliku;
- pełna kontrola Media Session i odtwarzania w tle;
- brak reklam, ekranów końcowych i linków narzuconych przez YouTube.

Przy aktywnym zastępowaniu `controls=0` i `disablekb=1` są tylko dodatkową wskazówką w URL — rozszerzenie nie polega na ich respektowaniu. CSS wykonywany wewnątrz iframe ukrywa wszystkie bezpośrednie warstwy `.html5-video-player` poza kontenerem obrazu, napisami, loaderem oraz oznaczeniami i przyciskami reklamowymi. Osobne selektory wycinają portale klasycznego UI i nowego wariantu (`ytwPlayer…`, `player-controls-*`, menu ustawień i rekomendacje fullscreen), również gdy są montowane poza zwykłym drzewem warstw playera.

## Dwukierunkowy bridge playera

Komunikacja przebiega przez dwa eventy DOM na `document` strony głównej sparowanej instancji. `detail` zawsze jest stringiem JSON, ponieważ aplikacja i content script rozszerzenia działają w odseparowanych światach JavaScript.

- iframe → aplikacja: `ytzero:enhance:player-event`;
- aplikacja → iframe: `ytzero:enhance:player-command`.

Eventy z playera mają wspólną kopertę:

```json
{
  "version": 1,
  "videoId": "dQw4w9WgXcQ",
  "type": "state",
  "timestamp": 1785012300000,
  "payload": {}
}
```

Obsługiwane typy to:

- `ready` — player jest gotowy; `payload.state` zawiera pierwszy snapshot;
- `state` — snapshot po play/pause, głośności, prędkości, fullscreen/PiP, komendzie oraz maksymalnie raz na sekundę podczas odtwarzania;
- `shortcut` — każdy skrót obsługiwany przez rozszerzenie wraz z `key`, `code`, logiczną `action`, `repeat` i modyfikatorami;
- `captions-toggle-request` — kliknięcie przycisku napisów albo `C`;
- `ended` — zakończenie filmu;
- `command-result` — wynik komendy, powiązany przez `payload.requestId`.

Snapshot `state` zawiera: `paused`, `ended`, `currentTime`, `duration`, `volume`, `muted`, `playbackRate`, `captionSize`, `captionsEnabled`, `fullscreen` i `pictureInPicture`.

Komenda aplikacji:

```json
{
  "version": 1,
  "requestId": "unikalny-identyfikator",
  "videoId": "dQw4w9WgXcQ",
  "command": "seek-by",
  "payload": { "seconds": 15 }
}
```

Obsługiwane komendy:

| Komenda | Payload |
|---|---|
| `play`, `pause`, `toggle-play` | `{}` |
| `seek-by`, `seek-to` | `{ "seconds": number }` |
| `set-volume` | `{ "volume": 0..1 }` |
| `set-muted`, `set-captions` | `{ "enabled": boolean }` |
| `toggle-muted`, `toggle-captions` | `{}` |
| `set-playback-rate` | `{ "rate": 0.25..4 }` |
| `set-caption-size` | `{ "pixels": 12..48 }` |
| `capture-frame` | `{}` |
| `toggle-fullscreen`, `enter-fullscreen`, `exit-fullscreen` | `{}` |
| `request-state` | `{}` |

Przycisk napisów zachowuje również kompatybilny event `ytzero:enhance:captions-toggle-request`. Zawiera on `currentEnabled` i `requestedEnabled`; jeśli stanu nie da się odczytać, oba pola są `null`. Docelowo aplikacja może korzystać wyłącznie z ogólnego `player-event`.

## Scenariusze regresji

Sprawdź co najmniej:

1. iframe `youtube.com/embed/:id` i `youtube-nocookie.com/embed/:id` na obcej domenie;
2. iframe tworzony dynamicznie przez IFrame Player API w YT Zero;
3. player w zwykłym widoku, theater i fullscreen;
4. PNG, JPEG i WebP przy DPR 1 oraz DPR 2;
5. film 16:9, pionowy i z letterboxem;
6. dwa embedy na jednej stronie — zrzut aktywnego/widocznego;
7. jakość preferowaną, napisy przez `C`, zmianę ich rozmiaru oraz zwijaną głośność;
8. nawigację `watch`, `shorts`, `live`, `youtu.be`, timestamp oraz instancję pod subpath;
9. wyłączone przekierowania i skrót `Alt+Shift+Y`;
10. Chrome/Edge/Brave i Firefox, także z restrykcyjną ochroną śledzenia.
11. parowanie instancji głównej i reverse-proxy, konfigurację z DOM, zmianę profilu oraz przełączenie instancji domyślnej;
12. screenshot request z YT Zero, synchroniczne `preventDefault()` i rezultat `saved`/`error`.
