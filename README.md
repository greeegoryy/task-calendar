# DailyFlow

Kalendarz zadań z logowaniem, aktywacją konta przez e-mail, panelem administratora i dziennikiem audytu. Frontend korzysta z React i FullCalendar, a API z FastAPI i PostgreSQL.

## DailyFlow jako projekt DevOps

GitHub Actions buduje obrazy frontendu i backendu, testuje migracje na PostgreSQL i publikuje obrazy w GitHub Container Registry. Wdrożenie na GKE używa tagów powiązanych z commitem, osobnego zadania migracji Alembic i weryfikacji stanu obu Deploymentów. Pipeline uzyskuje dostęp do GCP przez Workload Identity Federation.

| Dokument | Zawartość |
| --- | --- |
| [Architektura DevOps](docs/devops.md) | Środowiska, GKE, historia wdrożeń i środowiska |

## Uruchomienie lokalne

Potrzebujesz Dockera z Compose. Na Windows użyj Docker Desktop z silnikiem WSL 2.

1. W katalogu projektu uruchom `docker compose up --build -d`. Compose poczeka na PostgreSQL, wykona migracje Alembic i uruchomi aplikację.
2. Otwórz aplikację pod adresem http://localhost:3000 i zarejestruj konto.
3. Otwórz lokalną skrzynkę Mailpit pod adresem http://localhost:8025 i przejdź do linku aktywacyjnego z wiadomości, aby ustawić hasło.

Dokumentacja API jest dostępna pod adresem http://localhost:8000/docs. Frontend przekazuje żądania `/api/` przez Nginx. Dane PostgreSQL są przechowywane w wolumenie `postgres_data`. Lokalne hasło bazy można ustawić przez `POSTGRES_PASSWORD` w pliku `.env`.

## Polecenia

- `docker compose ps -a` pokazuje stan aplikacji i zadania migracji. Po udanej migracji zadanie `migrate` kończy się kodem 0.
- `docker compose logs migrate backend` pokazuje logi migracji i API.
- `docker compose down` zatrzymuje aplikację i zachowuje dane.
- `docker compose down -v` usuwa także wolumen z danymi.
- `bash scripts/postgres-recovery-drill.sh` odtwarza kopię danych testowych w osobnym Compose i sprawdza aplikację.
