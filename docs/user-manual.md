# DailyFlow Application Manual

DailyFlow is a task calendar and an AI-assisted learning project. This manual covers local setup, account activation, the calendar, the administrator panel, and basic troubleshooting. See the [DevOps architecture](devops.md) for deployment and infrastructure details.

## 1. Run the application locally

On Windows, start Docker Desktop and enable WSL 2 integration for your distribution. On Linux, you need a running Docker Engine, the Compose plugin, and permission to access the engine. The commands below use Bash or WSL. The basic Docker Compose commands also work in PowerShell.

```bash
docker version
docker compose version
git clone https://github.com/greeegoryy/task-calendar.git
cd task-calendar
docker compose config --quiet
docker compose up --build --wait --wait-timeout 150
docker compose ps -a
```

If you already cloned the repository, start from its root. On the first run, Docker may download base images and build the frontend and API containers. The `db` service starts PostgreSQL, and `migrate` runs `alembic upgrade head` and exits with code 0. The API starts after migration succeeds. The frontend becomes available after the API passes its health check. Mailpit captures email sent by this local instance.

| Address | Purpose |
| --- | --- |
| [Application](http://localhost:3000) | Calendar, registration, and the administrator panel |
| [Mailpit](http://localhost:8025) | Account activation emails |
| [OpenAPI](http://localhost:8000/docs) | Swagger UI and the API endpoint list |
| [Health check](http://localhost:3000/health) | A `{"status":"ok"}` response through Nginx, FastAPI, and PostgreSQL |

Use `docker compose down` to stop the services and keep the data. After changing application code or a Dockerfile, run `docker compose up --build --wait`. Adding `--volumes` to `docker compose down` also deletes the database. Use it to deliberately reset a disposable demo instance.

Local setup uses Docker Compose. Terraform is used for the cloud backup infrastructure. See [Infrastructure as code](devops.md#infrastructure-as-code-with-terraform) for its scope.

## 2. Register and use the calendar

The application interface is in Polish. The labels below match what you see on screen.

1. Open the registration form and enter a name and a test email address such as `demo@example.com`.
2. In Mailpit, open **DailyFlow - Activate your account** and follow the activation link. The link is single-use and expires after 24 hours.
3. Set a password between 12 and 128 characters, then sign in with your email address and password.
4. Click **+ Nowe zadanie** (New task) or select a time range on the calendar. Enter a title, times, and a color, then click **Zapisz** (Save).
5. Click an existing task to edit it, mark it **Wykonane** (Done), or delete it. Drag the task to reschedule it or resize it to change its duration.
6. Switch between **Miesiąc** (Month), **Tydzień** (Week), and **Dzień** (Day). Click **Dzisiaj** (Today) to return to the current date and **Wyloguj** (Sign out) to end your session.

If you reuse an email address, check whether the account already exists. For a new demo, use another address under `example.com`. Mailpit captures the message locally.

## 3. Set up a local administrator

Registration creates a regular user. To set up the first administrator, register and activate a demo account. Run this command only against your local Compose instance. Replace `demo@example.com` with that account's email. Expect exactly one updated row, reported as `UPDATE 1`.

```bash
docker compose exec -T db psql -X -v ON_ERROR_STOP=1 -U calendar -d calendar \
  -c "UPDATE users SET is_admin = TRUE WHERE email = 'demo@example.com' \
  AND is_active RETURNING email, is_admin;"
```

Sign out and sign back in to refresh the account details. Open **Panel administratora** (Administrator panel).

- **Użytkownicy** (Users) lists accounts, their status, and their roles. Activate a second user to demonstrate granting and revoking the administrator role. The panel prevents revoking the role from the last active administrator.
- **Zadania** (Tasks) lets you filter, edit, and delete tasks across accounts. Create a task in a second account to demonstrate the difference between its owner's calendar and the administrator view.
- **Historia aktywności** (Activity history) shows audit events such as sign-ins, task changes, and role changes made through the API. Setting the first administrator directly in the database bypasses the application audit trail. Use a change made through the panel to demonstrate an audit event.

## 4. Troubleshoot local problems

```bash
docker compose ps -a
docker compose logs --tail=100 db migrate backend frontend mailpit
docker compose exec -T db pg_isready -U calendar -d calendar
docker ps --format 'table {{.Names}}\t{{.Ports}}'
bash scripts/smoke-test.sh http://localhost:3000
```

| Symptom | What to check |
| --- | --- |
| Docker does not respond | Start the engine and check that `docker version` shows both client and server. |
| A port is already in use | Check `docker ps`. Compose uses host ports 3000, 8000, and 8025 by default. To run a second instance, use a separate project and different host ports. Set `APP_BASE_URL` and `ALLOWED_ORIGINS` to the new frontend address. |
| The frontend is waiting for the backend | Check the `migrate` container, API logs, and PostgreSQL readiness. A successful migration shows `Exited (0)`. |
| Mailpit shows no activation email | Check whether you registered a new address, whether Mailpit is running, and whether the API logs show SMTP delivery. |
| The activation link opens the wrong address | Compare the frontend URL with `APP_BASE_URL`. The default local address is `http://localhost:3000`. |
| The administrator panel is missing | Check that the account is active, the SQL command reported `UPDATE 1`, and you signed in again after the role change. |

## 5. Verification results

| Area | Results from November 27, 2026 |
| --- | --- |
| Docker Compose | A fresh database started, Alembic migrations completed, and the smoke test passed through Nginx. The test ran on separate ports because the default instance was already running. |
| Local application | HTTP checks covered registration, Mailpit, activation, sign-in, task creation and completion, local administrator setup, editing through the administrator API, audit, deletion, and sign-out. All 42 backend tests passed against PostgreSQL. |
| Public GKE deployment | The HTTPS smoke test passed on its first attempt for both the home page and `/health`. [GitHub Actions runs](https://github.com/greeegoryy/task-calendar/actions) |
