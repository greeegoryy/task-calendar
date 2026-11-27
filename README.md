# DailyFlow

DailyFlow to projekt edukacyjny wygenerowany z pomocą AI i rozwijany przede wszystkim do nauki DevOps. Kalendarz zadań daje prosty kontekst do ćwiczenia budowania kontenerów, testowania na PostgreSQL, publikowania obrazów, wdrażania na Kubernetes i odzyskiwania usługi po awarii.

GitHub Actions buduje obrazy i publikuje je w GitHub Container Registry. Pipeline na GKE używa tagów powiązanych z commitem, krótkotrwałego uwierzytelniania przez Workload Identity Federation, migracji Alembic oraz smoke testu przez publiczny HTTPS.

## Uruchomienie lokalne w Dockerze

Potrzebujesz Git oraz działającego Dockera z pluginem Docker Compose. Na Windows uruchom Docker Desktop z integracją WSL 2. Docker Compose zbuduje i uruchomi kontenery aplikacji, PostgreSQL oraz lokalną skrzynkę Mailpit.

```bash
git clone https://github.com/greeegoryy/task-calendar.git
cd task-calendar
docker compose config --quiet
docker compose up --build --wait --wait-timeout 150
docker compose ps -a
```

Jeśli masz już repozytorium, wykonaj polecenia Compose w jego katalogu. Po prawidłowym starcie `migrate` powinien zakończyć się kodem 0. Backend startuje po migracji, a frontend po przejściu kontroli backendu.

| Adres | Do czego służy |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Rejestracja, logowanie i kalendarz |
| [localhost:8025](http://localhost:8025) | Mailpit z lokalnym linkiem aktywacyjnym |
| [localhost:8000/docs](http://localhost:8000/docs) | Dokumentacja OpenAPI |
| [localhost:3000/health](http://localhost:3000/health) | Sprawdzenie API i PostgreSQL przez Nginx |

1. Na stronie aplikacji zarejestruj się np. jako `demo@example.com`.
2. Otwórz Mailpit i kliknij link z wiadomości aktywacyjnej.
3. Ustaw hasło liczące co najmniej 12 znaków, zaloguj się i utwórz pierwsze zadanie.

```bash
docker compose logs --tail=100 db migrate backend frontend mailpit
docker compose down
```

`docker compose down` zachowuje dane PostgreSQL w wolumenie `postgres_data`. Dodanie `--volumes` usuwa dane lokalnej instancji. Jeśli port jest zajęty, użyj `docker ps` i sprawdź, czy aplikacja już działa. Lokalną konfigurację hasła bazy możesz zmienić przez `POSTGRES_PASSWORD` w pliku `.env` przed pierwszą inicjalizacją wolumenu.

## Dokumentacja i portfolio

| Dokument | Zawartość |
| --- | --- |
| [Manual DailyFlow](docs/user-manual.md) | Start od zera, rejestracja, kalendarz, panel admina, diagnostyka i demo |
| [Architektura DevOps](docs/devops.md) | Środowiska, GKE, CI/CD i historia wdrożeń |

Lokalna próba odtwarzania danych korzysta z niezależnego środowiska Compose. Uruchom ją poleceniem `bash scripts/postgres-recovery-drill.sh`.
