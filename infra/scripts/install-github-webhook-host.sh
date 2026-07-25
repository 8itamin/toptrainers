#!/usr/bin/env bash
# One-time privileged host setup for the GitHub webhook receiver.

set -Eeuo pipefail
umask 077

install -d -m 700 /etc/toptrainers

if [[ ! -f /etc/toptrainers/webhook.env ]]; then
    printf 'WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/toptrainers/webhook.env
fi
chmod 600 /etc/toptrainers/webhook.env

if [[ ! -f /etc/toptrainers/github-deploy-key ]]; then
    ssh-keygen -q -t ed25519 -N '' -f /etc/toptrainers/github-deploy-key -C toptrainers-production-deploy
fi
chmod 600 /etc/toptrainers/github-deploy-key
chmod 644 /etc/toptrainers/github-deploy-key.pub

printf '%s\n' 'ab ALL=(root) NOPASSWD: /bin/systemctl start --no-block toptrainers-deploy.service' \
    > /etc/sudoers.d/toptrainers-webhook
chmod 440 /etc/sudoers.d/toptrainers-webhook
visudo -cf /etc/sudoers.d/toptrainers-webhook

systemctl daemon-reload
