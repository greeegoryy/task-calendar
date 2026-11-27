#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
docker info --format '{{.ServerVersion}}' >/dev/null

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/dailyflow-recovery-XXXXXXXX")
project_prefix=$(basename "$work_dir" | tr '[:upper:]' '[:lower:]')
source_project=${project_prefix}-source
restore_project=${project_prefix}-restore
export DAILYFLOW_DRILL_IMAGE=dailyflow-postgres-drill:${project_prefix}
export POSTGRES_PASSWORD=local_recovery_drill
export COMPOSE_PROFILES=

compose=(docker compose --project-directory "$repo_dir" --env-file /dev/null
  -f "$repo_dir/compose.yaml" -f "$work_dir/compose.override.yaml")
source_stack=("${compose[@]}" -p "$source_project")
restore_stack=("${compose[@]}" -p "$restore_project")

cleanup() {
  local status=$?
  trap - EXIT
  if ((status != 0)); then
    "${restore_stack[@]}" ps -a >&2 || true
    "${restore_stack[@]}" logs --tail=40 db migrate backend frontend >&2 || true
    "${source_stack[@]}" logs --tail=40 db >&2 || true
  fi
  "${restore_stack[@]}" down --volumes --remove-orphans --rmi local || status=1
  "${source_stack[@]}" down --volumes --remove-orphans --rmi local || status=1
  docker image rm "$DAILYFLOW_DRILL_IMAGE" >/dev/null 2>&1 || true
  rm -f "$work_dir/compose.override.yaml" "$work_dir/calendar.dump"
  rmdir "$work_dir"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cat > "$work_dir/compose.override.yaml" <<'YAML'
services:
  migrate:
    image: ${DAILYFLOW_DRILL_IMAGE:?}
  backend:
    image: ${DAILYFLOW_DRILL_IMAGE:?}
    ports: !reset []
  frontend:
    ports: !override ["127.0.0.1::80"]
  mailpit:
    ports: !reset []
YAML

psql_in() {
  local project=$1
  shift
  "${compose[@]}" -p "$project" exec -T db psql -X -v ON_ERROR_STOP=1 \
    -U calendar -d calendar "$@"
}

printf 'Source project: %s\nRestore project: %s\n' "$source_project" "$restore_project"

# Prepare release images before starting the recovery timer.
"${restore_stack[@]}" build backend frontend
"${source_stack[@]}" up -d --wait --wait-timeout 90 db
"${source_stack[@]}" run --rm --no-deps migrate
expected_revision=$(psql_in "$source_project" -Atc 'SELECT version_num FROM alembic_version;')
[[ -n "$expected_revision" ]]

psql_in "$source_project" <<'SQL'
INSERT INTO users (id, first_name, email, is_active, is_admin, created_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'Recovery Drill',
        'recovery-drill@example.test', false, false, now());

INSERT INTO tasks (id, user_id, title, description, start, "end", color, completed)
VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        'Saved before backup', '', now(), now() + interval '1 hour', '#6366f1', false);
SQL

backup_started=$SECONDS
"${source_stack[@]}" exec -T db pg_dump -U calendar -Fc calendar > "$work_dir/calendar.dump"
backup_bytes=$(wc -c < "$work_dir/calendar.dump")
[[ "$backup_bytes" -gt 0 ]]

psql_in "$source_project" <<'SQL'
INSERT INTO tasks (id, user_id, title, description, start, "end", color, completed)
VALUES ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
        'Written after backup', '', now(), now() + interval '1 hour', '#6366f1', false);
SQL

restore_started=$SECONDS
backup_age=$((restore_started - backup_started))
"${restore_stack[@]}" up -d --wait --wait-timeout 90 db
"${restore_stack[@]}" exec -T db pg_restore -U calendar -d calendar \
  --exit-on-error --single-transaction --no-owner --no-privileges \
  < "$work_dir/calendar.dump"

# Verify the restored snapshot before allowing the application's migration to run.
restored_revision=$(psql_in "$restore_project" -Atc 'SELECT version_num FROM alembic_version;')
if [[ "$restored_revision" != "$expected_revision" ]]; then
  printf 'FAIL: expected Alembic revision %s, got %s\n' "$expected_revision" "$restored_revision" >&2
  exit 1
fi

restored_fixture=$(psql_in "$restore_project" -Atc "
  SELECT
    EXISTS (
      SELECT 1 FROM tasks t JOIN users u ON t.user_id = u.id
      WHERE t.id = '20000000-0000-0000-0000-000000000001'
        AND t.title = 'Saved before backup'
        AND u.email = 'recovery-drill@example.test'
    )
    AND NOT EXISTS (
      SELECT 1 FROM tasks WHERE id = '20000000-0000-0000-0000-000000000002'
    );
")
if [[ "$restored_fixture" != t ]]; then
  echo 'FAIL: restored records do not match the backup cutoff' >&2
  exit 1
fi

"${restore_stack[@]}" up -d --no-build --wait --wait-timeout 150
frontend_address=$("${restore_stack[@]}" port frontend 80)
# Docker Desktop on Windows can append CR to command output.
frontend_address=${frontend_address%$'\r'}
bash "$repo_dir/scripts/smoke-test.sh" "http://$frontend_address"

elapsed=$((SECONDS - restore_started))
printf '\nPASS: restored Alembic revision %s and the expected snapshot records\n' "$restored_revision"
printf 'Backup size: %s bytes\nBackup age at start of recovery: %ss\n' "$backup_bytes" "$backup_age"
printf 'Recovery elapsed time (fresh PostgreSQL, restore, app start and smoke test): %ss\n' "$elapsed"
