# Manual DailyFlow

DailyFlow to kalendarz zadań i projekt edukacyjny wygenerowany z pomocą AI. W tym rozdziale uruchomisz lokalne środowisko, założysz konta demonstracyjne, obsłużysz kalendarz i panel administratora oraz poznasz podstawową diagnostykę. Szczegóły wdrożenia opisuje [architektura DevOps](devops.md).

## 1. Uruchom aplikację od zera

Na Windows uruchom Docker Desktop i włącz integrację z używaną dystrybucją WSL 2. Na Linuksie potrzebujesz działającego Docker Engine, pluginu Compose oraz dostępu użytkownika do silnika. Polecenia niżej używają Bash lub WSL. Podstawowe polecenia Docker Compose możesz też wykonać w PowerShell.

```bash
docker version
docker compose version
git clone https://github.com/greeegoryy/task-calendar.git
cd task-calendar
docker compose config --quiet
docker compose up --build --wait --wait-timeout 150
docker compose ps -a
```

Jeśli repozytorium jest już sklonowane, zacznij od jego katalogu. Na pierwszym starcie Docker może pobierać obrazy bazowe i budować Nginx oraz API. Usługa `db` uruchamia PostgreSQL, a `migrate` wykonuje `alembic upgrade head` i kończy się kodem 0. Po udanej migracji startuje API. Frontend udostępnia aplikację po uzyskaniu gotowości API. Mailpit przechwytuje pocztę z testowej instancji.

| Adres | Użycie |
| --- | --- |
| [Aplikacja](http://localhost:3000) | Kalendarz, rejestracja i panel administratora |
| [Mailpit](http://localhost:8025) | E-maile z linkiem aktywacyjnym |
| [OpenAPI](http://localhost:8000/docs) | Swagger UI i lista endpointów |
| [Kontrola /health](http://localhost:3000/health) | Odpowiedź `{"status":"ok"}` przez Nginx, FastAPI i PostgreSQL |

W codziennej pracy `docker compose down` zatrzymuje usługi i zachowuje dane. Aby ponownie wystartować po zmianie w kodzie lub Dockerfile, użyj `docker compose up --build --wait`. `docker compose down --volumes` usuwa również bazę i służy do celowego resetu danych demonstracyjnych.

## 2. Rejestracja i kalendarz

1. Otwórz aplikację i przejdź do formularza rejestracji. Podaj imię i adres `demo@example.com`. Użyj testowego adresu z poprawną składnią.
2. Wejdź do Mailpit i otwórz wiadomość **DailyFlow - Activate your account**. Kliknij link aktywacyjny prowadzący do aplikacji. Link jest jednorazowy i wygasa po 24 godzinach.
3. Ustaw hasło od 12 do 128 znaków. Wróć do logowania, wpisz adres i hasło.
4. Kliknij **+ Nowe zadanie** lub zaznacz przedział w kalendarzu. Podaj tytuł, godziny i kolor, a następnie wybierz **Zapisz**.
5. Kliknij istniejące zadanie, aby edytować dane, zaznaczyć **Wykonane** lub je usunąć. W kalendarzu możesz przeciągnąć zadanie na inny termin i zmienić jego długość.
6. Użyj widoku **Miesiąc**, **Tydzień** lub **Dzień**. W razie potrzeby wróć do bieżącej daty przez **Dzisiaj**. Zakończ sesję przyciskiem **Wyloguj**.

W lokalnym Compose Mailpit pokazuje wiadomości wysłane w środowisku demonstracyjnym. Przy ponownym użyciu tego samego adresu sprawdź, czy konto już istnieje. Do nowego demo możesz użyć innego adresu w domenie `example.com`.

## 3. Panel administratora do demonstracji

Rejestracja tworzy zwykłego użytkownika. Aby przygotować pierwsze konto administratora, najpierw zarejestruj i aktywuj konto demonstracyjne. Poniższe polecenie wykonaj wyłącznie na własnym lokalnym Compose. Zamień `demo@example.com` na adres tego konta. Polecenie powinno zwrócić dokładnie jedną zmianę, `UPDATE 1`.

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U calendar -d calendar \
  -c "UPDATE users SET is_admin = TRUE WHERE email = 'demo@example.com' \
  AND is_active RETURNING email, is_admin;"
```

Wyloguj się i zaloguj ponownie, aby aplikacja odświeżyła dane konta. Otwórz **Panel administratora**.

- **Użytkownicy** pokazują listę kont, status i role. Aby zademonstrować zmianę roli, aktywuj najpierw drugiego użytkownika. Nadaj mu uprawnienia przez panel, a następnie je odbierz. Ostatni aktywny administrator jest chroniony przed odebraniem roli przez panel.
- **Zadania** pozwalają wyświetlić zadania różnych kont, zawęzić wyniki filtrami i edytować albo usunąć wybrane zadanie. Przygotuj zadanie na drugim koncie, aby pokazać różnicę między widokiem właściciela a widokiem administratora.
- **Historia aktywności** pokazuje zdarzenia audytu, m.in. logowanie, operacje na zadaniach i zmiany ról dokonywane przez API. Bootstrap roli bezpośrednio w bazie omija ścieżkę audytu aplikacji. Na demo pokaż zdarzenie utworzone przez panel.

## 4. Typowe problemy i ich diagnoza

```bash
docker compose ps -a
docker compose logs --tail=100 db migrate backend frontend mailpit
docker compose exec -T db pg_isready -U calendar -d calendar
docker ps --format 'table {{.Names}}\t{{.Ports}}'
bash scripts/smoke-test.sh http://localhost:3000
```

| Objaw | Co sprawdzić |
| --- | --- |
| Docker nie odpowiada | Uruchom silnik i sprawdź, czy `docker version` pokazuje klienta oraz serwer. |
| Port jest zajęty | Sprawdź `docker ps`. Lokalny Compose używa portów 3000, 8000 i 8025. Przy równoległej instancji użyj osobnego projektu i portów, a adres frontendu zapisz w `APP_BASE_URL` oraz `ALLOWED_ORIGINS`. |
| Frontend czeka na backend | Sprawdź `migrate`, logi API i dostępność PostgreSQL. Poprawny stan migracji to `Exited (0)`. |
| Mailpit nie pokazuje wiadomości | Sprawdź, czy rejestrujesz nowy adres, czy Mailpit działa i czy w logach backendu widać dostarczenie SMTP. |
| E-mail otwiera zły adres | Porównaj adres frontendu z ustawieniem `APP_BASE_URL`. Otwieraj lokalną aplikację pod adresem `localhost:3000` zgodnym z domyślną konfiguracją. |
| Brakuje panelu administratora | Sprawdź, czy konto jest aktywne, SQL zwrócił `UPDATE 1`, a po zmianie roli wykonano nowe logowanie. |

## 5. Co zostało sprawdzone

| Zakres | Wynik z 27 listopada 2026 r. |
| --- | --- |
| Docker Compose | Start z pustą bazą, migracje Alembic i smoke test przez Nginx zakończyły się powodzeniem. Próba użyła osobnych portów, ponieważ standardowa instancja była uruchomiona. |
| Aplikacja lokalna | Przez HTTP sprawdzono rejestrację, Mailpit, aktywację, logowanie, utworzenie i ukończenie zadania, lokalną konfigurację admina, edycję z widoku administracyjnego API, wpis audytu, usunięcie i wylogowanie. Przeszły 42 testy backendu z PostgreSQL. |
| Publiczny GKE | Smoke test HTTPS zaliczył stronę główną oraz `/health` przy pierwszym podejściu. [Przebiegi GitHub Actions](https://github.com/greeegoryy/task-calendar/actions) |
