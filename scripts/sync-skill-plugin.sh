#!/usr/bin/env bash
#
# Sync plugin skill references and version from source documents.
# Run this as part of the tagpr release workflow.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_DIR="${REPO_ROOT}/skills/runestone-workflow"

# --- Version sync ---
# Update SKILL.md metadata.version from manifest.json
VERSION=$(node -p "require('${REPO_ROOT}/manifest.json').version")
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

# --- Reference sync: glossary.md ---
# Extract GLOSSARY.md content, replacing the title
{
  echo "# Runestone Glossary"
  echo ""
  echo "Domain-specific terms used in Runestone workflows."
  # Skip the original title and description (first 3 lines)
  tail -n +4 "${REPO_ROOT}/GLOSSARY.md"
} > "${SKILL_DIR}/references/glossary.md"
echo "Updated glossary.md from GLOSSARY.md"

# --- Reference sync: node-types.md ---
# Extract Node Types, Frontmatter Reference, and Template Syntax from README.md
{
  echo "# Runestone Node Types"
  echo ""
  echo "This document describes the four node types available in Runestone workflows. Each node is a Markdown file with \`runestone.*\` frontmatter properties and a code block."
  echo ""
  # Extract from "## Node Types" up to (but not including) "## Settings"
  awk '/^## Node Types$/,/^## Settings$/{if(/^## Settings$/)exit; print}' "${REPO_ROOT}/README.md" \
    | tail -n +2
} > "${SKILL_DIR}/references/node-types.md"
echo "Updated node-types.md from README.md"

echo "Skill plugin sync complete."
