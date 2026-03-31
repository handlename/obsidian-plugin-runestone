#!/usr/bin/env bash
#
# Sync SKILL.md version from manifest.json.
# Run by tagpr via postVersionCommand.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_DIR="${REPO_ROOT}/skills/runestone-workflow"

# Update SKILL.md metadata.version from manifest.json
VERSION=$(jq -r '.version' "${REPO_ROOT}/manifest.json")
SKILL_FILE="${SKILL_DIR}/SKILL.md"
TMPFILE=$(mktemp)
awk -v ver="${VERSION}" '{
  if ($0 ~ /^  version: ".*"/) {
    print "  version: \"" ver "\""
  } else {
    print
  }
}' "${SKILL_FILE}" > "${TMPFILE}" && mv "${TMPFILE}" "${SKILL_FILE}"
echo "Updated SKILL.md version to ${VERSION}"
