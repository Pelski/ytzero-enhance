# Privacy policy / polityka prywatności

**YT Zero Enhance does not collect, transmit, sell, or share personal data. It contains no analytics, advertising, telemetry, or remote code.**

Przełączniki samego rozszerzenia oraz adres instancji domyślnej są zapisywane przez `storage.sync` przeglądarki. Lista sparowanych instancji i ostatnia poprawna konfiguracja aktywnego profilu są przechowywane lokalnie przez `storage.local`. Zależnie od ustawień konta przeglądarka może zsynchronizować pierwszą z tych grup między urządzeniami. Rozszerzenie nie ma do danych zewnętrznego dostępu.

## Uzasadnienie uprawnień

- `storage`: zapis ustawień;
- `webNavigation`: wykrycie nawigacji do obsługiwanych adresów filmów;
- `tabs`: przekierowanie bieżącej karty i skoordynowanie zrzutu między cross-origin iframe a stroną nadrzędną;
- `activeTab`: ręczne wywołanie funkcji na aktywnej karcie;
- wymagane hosty odtwarzacza: uruchomienie kontrolek wewnątrz `youtube.com/embed` i `youtube-nocookie.com/embed`;
- opcjonalne hosty HTTP/HTTPS: przeglądarka przyznaje dostęp dopiero do originu instancji sparowanej przez użytkownika. Jest potrzebny do odczytu konfiguracji osadzonej w DOM zalogowanej strony, bridge’u top-page i precyzyjnego cropu iframe.

Podczas zrzutu API przeglądarki tworzy obraz widocznej karty. Jest on przetwarzany wyłącznie lokalnie w pamięci: rozszerzenie kadruje player, inicjuje pobranie pliku i zwalnia tymczasowy adres obiektu. Obraz nigdzie nie jest wysyłany.

Rozszerzenie łączy się wyłącznie z:

- adresem instancji YT Zero sparowanej przez użytkownika — po otwarciu strony lub przekierowaniu;
- serwisem źródłowym jako częścią strony lub odtwarzacza, który użytkownik sam otworzył.

Kontakt i źródło: [github.com/Pelski/ytzero](https://github.com/Pelski/ytzero).

Osadzona konfiguracja zawiera wyłącznie preferencje prezentacji playera. Nie zawiera tożsamości profilu, sekretów, konfiguracji logowania ani prywatnego stanu filmów.
