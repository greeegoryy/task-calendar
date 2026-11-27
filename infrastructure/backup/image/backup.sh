#!/bin/sh
set -eu
umask 077

: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${POD_UID:?POD_UID is required}"

# pg_dump accepts a PostgreSQL URI as --dbname, without the SQLAlchemy suffix.
case ${DATABASE_URL:-} in
  postgresql+psycopg://*) database=postgresql://${DATABASE_URL#postgresql+psycopg://} ;;
  postgresql://*|postgres://*) database=$DATABASE_URL ;;
  '') database=${PGDATABASE:?DATABASE_URL or PGDATABASE is required} ;;
  *)
    echo 'Unsupported PostgreSQL connection URI' >&2
    exit 1
    ;;
esac
unset DATABASE_URL

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

archive="$work_dir/postgres.dump"
object="postgres/$(date -u +%Y/%m/%d/%Y%m%dT%H%M%SZ)-$POD_UID.dump"
pg_dump -Fc --no-owner --no-privileges --lock-wait-timeout=30s \
  --dbname="$database" --file="$archive"
pg_restore --list "$archive" >/dev/null
size=$(wc -c < "$archive" | tr -d '[:space:]')

token_response=$(curl --fail-with-body --silent --show-error \
  --connect-timeout 5 --max-time 30 --retry 3 --retry-max-time 25 \
  -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
token=$(printf '%s' "$token_response" | jq -er '.access_token | strings | select(length > 0)')
escaped_object=$(jq -rn --arg object "$object" '$object | @uri')

# The token is passed to curl via stdin so it is absent from the process arguments.
printf 'header = "Authorization: Bearer %s"\n' "$token" |
  curl --config - --fail-with-body --silent --show-error \
    --connect-timeout 10 --max-time 900 \
    -H 'Content-Type: application/octet-stream' --data-binary "@$archive" \
    "https://storage.googleapis.com/upload/storage/v1/b/$BACKUP_BUCKET/o?uploadType=media&ifGenerationMatch=0&name=$escaped_object" \
    > "$work_dir/upload.json"

jq -e --arg bucket "$BACKUP_BUCKET" --arg object "$object" --arg size "$size" \
  '.bucket == $bucket and .name == $object and .size == $size' \
  "$work_dir/upload.json" >/dev/null

jq -nc --arg object "gs://$BACKUP_BUCKET/$object" --argjson bytes "$size" \
  '{severity:"INFO", event:"dailyflow_postgres_backup_success", object:$object, bytes:$bytes}'
