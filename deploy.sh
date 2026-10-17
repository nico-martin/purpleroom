#!/usr/bin/env bash
set -euo pipefail
: "${DEPLOY_HOST:?Set DEPLOY_HOST to your cyon SSH host}"
DEST="${DEPLOY_DEST:-~/public_html/green-room}"
pnpm build
rsync -avz --delete --exclude 'api/' dist/ "$DEPLOY_HOST:$DEST/"
rsync -avz --delete --exclude 'db/db.sqlite*' --exclude 'db/sessions/' --exclude 'db/logos/' --exclude 'config.local.php' api/ "$DEPLOY_HOST:$DEST/api/"
ssh "$DEPLOY_HOST" "cd $DEST && php api/db/migrate.php"
