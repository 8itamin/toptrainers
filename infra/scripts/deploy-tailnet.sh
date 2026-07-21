#!/usr/bin/env bash
# Deploy a checked-out TopTrainers release on a Tailnet host.
# This script deliberately does not fetch code, change Tailscale settings, or
# publish ports. Run it from a trusted, reviewed checkout on the target host.

set -Eeuo pipefail

readonly REPOSITORY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly COMPOSE_FILE="$REPOSITORY_DIR/infra/compose/compose.yaml"
readonly ENV_FILE="${TT_ENV_FILE:-/etc/toptrainers/prod.env}"

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Required command is missing: $1"
}

dc() {
    docker compose \
        --project-directory "$REPOSITORY_DIR" \
        --env-file "$ENV_FILE" \
        -f "$COMPOSE_FILE" \
        "$@"
}

require_command docker
require_command curl
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."

[[ -r "$COMPOSE_FILE" ]] || fail "Compose file was not found: $COMPOSE_FILE"
[[ -r "$ENV_FILE" ]] || fail "Environment file was not found or is unreadable: $ENV_FILE"

# The production secrets file is intentionally private to the deploy operator.
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || \
    fail "Set permissions to 600 on $ENV_FILE before deploying."

if grep -Eq '^(POSTGRES_PASSWORD|TT_JWT_SIGNING_KEY)=.*(change-me|replace-with-a-long-random-secret)' "$ENV_FILE"; then
    fail "Replace placeholder database/JWT secrets in $ENV_FILE before deploying."
fi

grep -qx 'TT_ENVIRONMENT=production' "$ENV_FILE" || \
    fail "Set TT_ENVIRONMENT=production in $ENV_FILE before deploying."
grep -qx 'TT_OPENAPI_ENABLED=false' "$ENV_FILE" || \
    fail "Set TT_OPENAPI_ENABLED=false in $ENV_FILE before deploying."

dc config -q

printf '%s\n' 'Starting private data services...'
dc up -d postgres redis

printf '%s\n' 'Waiting for PostgreSQL and Redis...'
for attempt in $(seq 1 30); do
    if dc exec -T postgres sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1 \
        && dc exec -T redis redis-cli ping >/dev/null 2>&1; then
        break
    fi

    if [[ "$attempt" == "30" ]]; then
        fail "PostgreSQL or Redis did not become ready. Inspect: docker compose logs postgres redis"
    fi

    sleep 2
done

printf '%s\n' 'Applying Alembic migrations as a one-off container...'
dc --profile migrate run --rm --build migrate

printf '%s\n' 'Building and starting gateway, PWA, showcase and API...'
dc up -d --build gateway pwa showcase api

gateway_address="$(dc port gateway 8080)"
[[ -n "$gateway_address" ]] || fail "Could not resolve the gateway port."

printf '%s\n' "Checking gateway health at $gateway_address..."
curl --fail --silent --show-error --max-time 10 \
    "http://${gateway_address}/__gateway_health" >/dev/null

printf '%s\n' 'Deployment completed. Tailnet HTTPS exposure remains Tailscale Serve responsibility.'
