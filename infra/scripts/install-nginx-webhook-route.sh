#!/usr/bin/env bash
# Install the TopTrainers webhook route into the existing host Nginx vhost.

set -Eeuo pipefail

readonly VHOST=/etc/nginx/sites-enabled/toptrainers
readonly INCLUDE='    include /etc/nginx/snippets/toptrainers-webhook.location.conf;'
readonly CANDIDATE=/tmp/toptrainers-nginx-candidate.conf
readonly BACKUP_DIR=/etc/nginx/toptrainers-backups

grep -Fqx "$INCLUDE" "$VHOST" || {
    install -d -m 700 "$BACKUP_DIR"
    cp "$VHOST" "$BACKUP_DIR/toptrainers.before-webhook-$(date -u +%Y%m%dT%H%M%SZ)"
    awk -v include="$INCLUDE" '
        /^    location \/ \{/ && !inserted { print include; inserted = 1 }
        { print }
        END { if (!inserted) exit 1 }
    ' "$VHOST" > "$CANDIDATE"
    install -m 644 "$CANDIDATE" "$VHOST"
}

nginx -t
systemctl reload nginx
systemctl enable --now toptrainers-webhook.service
