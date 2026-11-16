# Task Calendar MVP

Prywatny kalendarz z React, FullCalendar, FastAPI, PostgreSQL i Docker Compose.

## Windows 11 — pierwsze uruchomienie

1. Otwórz PowerShell jako administrator i uruchom `wsl --install`. Zrestartuj komputer, jeśli system o to poprosi. Jeśli WSL jest już zainstalowany, pomiń ten krok.
2. Zainstaluj Docker Desktop: https://www.docker.com/products/docker-desktop/ . W ustawieniach użyj silnika WSL 2. Uruchom Docker Desktop i poczekaj, aż silnik będzie gotowy.
3. Rozpakuj archiwum projektu. W PowerShell przejdź do katalogu z `compose.yaml`, np. `cd "$HOME\Downloads\task-calendar"` (dostosuj ścieżkę).
4. Opcjonalnie skopiuj `.env.example` do `.env` i zmień hasło: `Copy-Item .env.example .env`.
5. Uruchom: `docker compose up --build -d`.
6. Otwórz http://localhost:3000 . API Swagger: http://localhost:8000/docs .

Pierwszy build może potrwać kilka minut.

## Polecenia

- `docker compose ps` — stan kontenerów
- `docker compose logs -f backend` — logi backendu
- `docker compose logs -f frontend` — logi frontendu
- `docker compose down` — zatrzymaj i usuń kontenery (dane pozostają)
- `docker compose up --build -d` — przebuduj i uruchom
- `docker compose down -v` — **usuwa także wszystkie zapisane zadania**

## Architektura

Przeglądarka -> nginx/React (localhost:3000) -> /api proxy -> FastAPI (backend:8000) -> PostgreSQL (db:5432). Port 8000 jest również dostępny lokalnie do debugowania. Baza nie jest wystawiona na hosta. Dane utrzymuje Docker named volume `postgres_data`.

## REST API

- GET /api/tasks
- POST /api/tasks
- GET /api/tasks/{id}
- PUT /api/tasks/{id}
- DELETE /api/tasks/{id}
- GET /health

Daty przesyłane są w ISO 8601 z informacją o strefie czasowej, np. `2026-11-16T15:00:00+01:00`.

## Ograniczenia MVP

To środowisko lokalne dla jednej osoby, **bez logowania**. Nie wystawiaj portów na Internet bez uwierzytelniania, TLS i odpowiedniej konfiguracji. `create_all` tworzy tabele na start; przed produkcją dodaj migracje Alembic. W kolejnych etapach dodaj testy, CI/CD, health/metrics, backupy, secrets i konfigurację produkcyjną. Zależności npm korzystają z zakresów wersji; dla powtarzalnych buildów wygeneruj i zatwierdź `package-lock.json`, a następnie zamień `npm install` na `npm ci`.
