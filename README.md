# DailyFlow


DailyFlow is an AI-assisted learning project built to practice DevOps. It uses a task calendar as a workload for container builds, PostgreSQL integration tests, image publishing, and Kubernetes deployments.

GitHub Actions builds the images and publishes them to GitHub Container Registry. The deployment pipeline authenticates to Google Cloud through Workload Identity Federation, runs database migrations before rolling out the application on Google Kubernetes Engine, and checks the public HTTPS endpoint after deployment.\

You can access app directly form this address: https://dailyflow-app.duckdns.org/

## Run locally with Docker

Install Git, Docker, and the Docker Compose plugin. On Windows, start Docker Desktop and enable WSL 2 integration for your distribution.

```bash
git clone https://github.com/greeegoryy/task-calendar.git
cd task-calendar
docker compose config --quiet
docker compose up --build --wait --wait-timeout 150
docker compose ps -a
```

If you already cloned the repository, run the Compose commands from its root. Compose starts PostgreSQL and Mailpit, runs Alembic migrations, and starts the API and frontend in order. A migration container in state `Exited (0)` indicates success.

| URL | Purpose |
| --- | --- |
| [localhost:3000](http://localhost:3000) | Sign-up, sign-in, and the calendar |
| [localhost:8025](http://localhost:8025) | Mailpit inbox for account activation |
| [localhost:8000/docs](http://localhost:8000/docs) | OpenAPI documentation |
| [localhost:3000/health](http://localhost:3000/health) | API and database health through Nginx |

1. Open the application and register with a test address such as `demo@example.com`.
2. Open Mailpit and follow the activation link.
3. Set a password of at least 12 characters, sign in, and create a task.

To inspect logs or stop the stack:

```bash
docker compose logs --tail=100 db migrate backend frontend mailpit
docker compose down
```

`docker compose down` keeps the PostgreSQL volume. Adding `--volumes` deletes the local database. If a port is already in use, run `docker ps` to check what is listening. Set `POSTGRES_PASSWORD` in a local `.env` file before initializing the database if you want a different local password.

## Documentation and portfolio

- [Application manual](docs/user-manual.md) — Docker startup, account activation, the calendar, and local administrator setup.
- [DevOps architecture](docs/devops.md) — container images, GKE, identity, database migrations, and the path from GitHub Actions to the public smoke test.
- [GitHub Actions](https://github.com/greeegoryy/task-calendar/actions) — CI and deployment history.
