#!/usr/bin/env bash
# Deploy the reviewed main branch after a validated GitHub webhook.

set -Eeuo pipefail
umask 077

readonly REPOSITORY_DIR="${TT_REPOSITORY_DIR:-/opt/toptrainers}"
readonly REMOTE_URL="${TT_GIT_REMOTE:-git@github.com:8itamin/toptrainers.git}"
readonly BRANCH="${TT_GIT_BRANCH:-main}"
readonly LOCK_FILE="${TT_DEPLOY_LOCK_FILE:-/var/lock/toptrainers-github-deploy.lock}"

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
flock -n 9 || {
    printf '%s\n' 'Deployment is already running; the newest push will be deployed by the active job.'
    exit 0
}

if [[ ! -d "$REPOSITORY_DIR/.git" ]]; then
    readonly STAGING_DIR="$(mktemp -d /opt/toptrainers-release.XXXXXX)"
    readonly LEGACY_DIR="${REPOSITORY_DIR}.pre-git-$(date -u +%Y%m%dT%H%M%SZ)"

    printf 'Bootstrapping the first managed checkout from %s\n' "$REMOTE_URL"
    git -c core.hooksPath=/dev/null clone --branch "$BRANCH" --single-branch "$REMOTE_URL" "$STAGING_DIR"
    [[ -f "$STAGING_DIR/infra/scripts/deploy-tailnet.sh" ]] || fail "Clone does not contain the deployment script."
    mv "$REPOSITORY_DIR" "$LEGACY_DIR"
    mv "$STAGING_DIR" "$REPOSITORY_DIR"
    printf 'Previous unmanaged release preserved at %s\n' "$LEGACY_DIR"
fi

cd "$REPOSITORY_DIR"
[[ "$(git config --get remote.origin.url)" == "$REMOTE_URL" ]] || fail "Unexpected origin remote."
[[ -z "$(git status --porcelain)" ]] || fail "Refusing to overwrite a dirty production checkout."

git -c core.hooksPath=/dev/null fetch --prune origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
readonly REVISION="$(git rev-parse --verify "refs/remotes/origin/$BRANCH^{commit}")"
git -c core.hooksPath=/dev/null checkout --detach --force "$REVISION"

printf 'Deploying revision %s\n' "$REVISION"
bash "$REPOSITORY_DIR/infra/scripts/deploy-tailnet.sh"

printf 'Deployment succeeded: %s\n' "$REVISION"
