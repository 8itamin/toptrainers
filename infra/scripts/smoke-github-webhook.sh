#!/usr/bin/env bash
# Verify the production receiver accepts a valid GitHub HMAC without deploying.

set -Eeuo pipefail

readonly WEBHOOK_ENV=/etc/toptrainers/webhook.env
readonly WEBHOOK_URL=https://toptrainers.ru/deploy/github
readonly PAYLOAD='{}'

[[ -r "$WEBHOOK_ENV" ]] || {
    printf 'Cannot read %s\n' "$WEBHOOK_ENV" >&2
    exit 1
}

# shellcheck disable=SC1090
source "$WEBHOOK_ENV"
readonly SIGNATURE="$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | awk '{print $NF}')"
readonly STATUS="$(curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --request POST \
    --header 'X-GitHub-Event: ping' \
    --header "X-Hub-Signature-256: sha256=$SIGNATURE" \
    --header 'Content-Type: application/json' \
    --data "$PAYLOAD" \
    "$WEBHOOK_URL")"

[[ "$STATUS" == '202' ]] || {
    printf 'Expected HTTP 202, got %s\n' "$STATUS" >&2
    exit 1
}

printf 'Webhook HMAC smoke test passed.\n'
