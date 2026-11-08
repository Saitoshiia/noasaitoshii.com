#!/usr/bin/env bash
set -euo pipefail

SERVICE="miinrva.show-media-intake.operator-key"
ACCOUNT="noasaitoshii"
ACTION="${1:-status}"

if ! command -v security >/dev/null 2>&1; then
  printf "macOS security command not found; Keychain is required.\n" >&2
  exit 1
fi

hash_key() {
  printf "%s" "$1" \
    | openssl dgst -sha256 -binary \
    | openssl base64 -A \
    | tr '+/' '-_' \
    | tr -d '='
}

key_exists() {
  security find-generic-password -s "$SERVICE" -a "$ACCOUNT" >/dev/null 2>&1
}

case "$ACTION" in
  status)
    if key_exists; then
      printf "Operator key is present in Keychain service %s for account %s.\n" "$SERVICE" "$ACCOUNT"
    else
      printf "Operator key is not present in Keychain service %s for account %s.\n" "$SERVICE" "$ACCOUNT"
      exit 2
    fi
    ;;
  create)
    if key_exists; then
      printf "Refusing to replace the existing operator key. Credential rotation is a separate reviewed procedure.\n" >&2
      exit 3
    fi
    operator_key="$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')"
    security add-generic-password \
      -a "$ACCOUNT" \
      -s "$SERVICE" \
      -w "$operator_key" >/dev/null
    printf "Stored a new operator key in macOS Keychain.\n"
    printf "MEDIA_INTAKE_OPERATOR_HASH=%s\n" "$(hash_key "$operator_key")"
    ;;
  hash)
    if ! key_exists; then
      printf "No operator key exists. Run %s create first.\n" "$0" >&2
      exit 2
    fi
    operator_key="$(security find-generic-password -s "$SERVICE" -a "$ACCOUNT" -w)"
    printf "MEDIA_INTAKE_OPERATOR_HASH=%s\n" "$(hash_key "$operator_key")"
    ;;
  *)
    printf "Usage: %s {status|create|hash}\n" "$0" >&2
    exit 64
    ;;
esac
