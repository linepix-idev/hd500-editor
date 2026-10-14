#!/usr/bin/env bash
# Publishes this project to GitHub (PRIVATE by default) and starts the installer builds (Linux, Windows, macOS) in GitHub Actions.
# Usage:  bash tools/publish.sh            -> private repo "hd500-editor"
#         VISIBILITY=public bash tools/publish.sh   -> public repo (only after you decided to release it)
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${REPO_NAME:-hd500-editor}"; VIS="${VISIBILITY:-private}"; TAG="v$(node -p "require('./package.json').version")"

command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com (macOS: brew install gh)"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "You are not logged in. Run:  gh auth login   (choose GitHub.com, HTTPS, login with the browser)"; exit 1; }
LOGIN="$(gh api user -q .login)"
echo "GitHub user: $LOGIN   repo: $LOGIN/$NAME   visibility: $VIS   tag: $TAG"
if [ "$VIS" = "public" ]; then read -r -p "This makes the code PUBLIC. Type 'public' to confirm: " a; [ "$a" = "public" ] || exit 1; fi

# replace the OWNER placeholder with your GitHub user
for f in README.md package.json; do sed -i.bak "s#github.com/OWNER/#github.com/$LOGIN/#g" "$f" && rm -f "$f.bak"; done
git add -A; git diff --cached --quiet || git commit -qm "Set repository owner to $LOGIN"

if gh repo view "$LOGIN/$NAME" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$LOGIN/$NAME.git"
else
  gh repo create "$LOGIN/$NAME" "--$VIS" --source=. --remote=origin --description "Free, cross-platform editor for the Line 6 POD HD500"
fi
git push -u origin main
git push origin "$TAG" 2>/dev/null || { git tag -f "$TAG" >/dev/null; git push -f origin "$TAG"; }
echo; echo "Pushed. The installers are being built now (about 10 minutes):"
echo "  https://github.com/$LOGIN/$NAME/actions"
echo "When it is green, download them with:  gh run download -R $LOGIN/$NAME -D installers"
