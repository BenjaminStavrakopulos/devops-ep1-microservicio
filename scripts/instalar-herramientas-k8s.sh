#!/usr/bin/env bash
# Instala en el runner las versiones fijadas de kustomize y kubeconform (Linux amd64).
# Versiones fijas = builds reproducibles; se actualizan de forma explícita mediante un PR.
set -euo pipefail

KUSTOMIZE_VERSION="v5.8.1"
KUBECONFORM_VERSION="v0.8.0"
DESTINO="${DESTINO:-/usr/local/bin}"
TMP="$(mktemp -d)"

curl -fsSL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" \
  | tar -xz -C "$TMP"
curl -fsSL "https://github.com/yannh/kubeconform/releases/download/${KUBECONFORM_VERSION}/kubeconform-linux-amd64.tar.gz" \
  | tar -xz -C "$TMP"
sudo install -m 0755 "$TMP/kustomize" "$TMP/kubeconform" "$DESTINO/"

kustomize version
kubeconform -v
