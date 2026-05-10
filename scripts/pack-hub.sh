#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/dist}"

mkdir -p "${OUTPUT_DIR}"

BUNDLE_NAME="wikihub-bundle"
STAGE_DIR="${OUTPUT_DIR}/${BUNDLE_NAME}"
ZIP_PATH="${OUTPUT_DIR}/${BUNDLE_NAME}.zip"
TAR_PATH="${OUTPUT_DIR}/${BUNDLE_NAME}.tar.gz"

rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"

copy_if_exists() {
  local rel="$1"
  if [[ -e "${ROOT_DIR}/${rel}" ]]; then
    mkdir -p "${STAGE_DIR}/$(dirname "${rel}")"
    cp -R "${ROOT_DIR}/${rel}" "${STAGE_DIR}/${rel}"
  fi
}

copy_if_exists "hub"
copy_if_exists "hub-data"
copy_if_exists "scripts/start-hub.ps1"
copy_if_exists "scripts/start-hub.sh"
copy_if_exists "scripts/pack-hub.ps1"
copy_if_exists "scripts/pack-hub.sh"
copy_if_exists "README-HUB.md"
copy_if_exists "test-page.html"

rm -f "${ZIP_PATH}" "${TAR_PATH}"

(
  cd "${STAGE_DIR}"
  zip -rq "${ZIP_PATH}" .
  tar -czf "${TAR_PATH}" .
)

echo
echo "Package created successfully."
echo "ZIP : ${ZIP_PATH}"
echo "TAR : ${TAR_PATH}"
echo
