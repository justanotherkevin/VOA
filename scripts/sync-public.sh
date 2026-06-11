#!/usr/bin/env bash
set -e

PRIVATE_REPO="$(git rev-parse --show-toplevel)"
PUBLIC_REPO="${1:-$HOME/Documents/github-personal/VOA}"
TMP_EXPORT="$(mktemp -d)"

echo "Exporting from: $PRIVATE_REPO"
echo "Syncing to:     $PUBLIC_REPO"

# Export only tracked files
git -C "$PRIVATE_REPO" archive HEAD | tar -x -C "$TMP_EXPORT"

# Strip internal files
/usr/bin/find "$TMP_EXPORT" -name "CLAUDE.md" -delete
rm -rf "$TMP_EXPORT/docs/plans"
rm -rf "$TMP_EXPORT/docs/notes.md"
rm -rf "$TMP_EXPORT/docs/claude-ref"
rm -rf "$TMP_EXPORT/.agents"

# Sync into the VOA clone (--delete removes files that no longer exist in private)
rsync -a --delete \
  --exclude='.git' \
  "$TMP_EXPORT/" "$PUBLIC_REPO/"

rm -rf "$TMP_EXPORT"

# Commit using the private repo's latest commit message
LATEST_MSG="$(git -C "$PRIVATE_REPO" log -1 --format='%s')"
cd "$PUBLIC_REPO"
git add -A
git diff --cached --quiet && echo "No changes to sync." && exit 0
git commit -m "sync: $LATEST_MSG"
git push
echo "Synced and pushed to VOA."
