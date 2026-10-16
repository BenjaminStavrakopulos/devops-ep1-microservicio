#!/usr/bin/env bash
# Despliega el microservicio en Kubernetes con Kustomize, verifica el rollout y ejecuta pruebas de humo.
# Si el despliegue o las pruebas fallan, revierte automáticamente a la revisión anterior.
#
# Variables:
#   OVERLAY       staging | production
#   IMAGE         imagen a desplegar (tag o digest)
#   CHANGE_CAUSE  texto de trazabilidad que queda en el historial del rollout (opcional)
#   GHCR_USER / GHCR_TOKEN  credenciales para descargar la imagen desde GHCR (solo production)
set -euo pipefail

: "${OVERLAY:?Definir OVERLAY (staging | production)}"
: "${IMAGE:?Definir IMAGE}"
NS="productos-${OVERLAY}"
CAUSA="${CHANGE_CAUSE:-despliegue manual de ${IMAGE}}"
SALIDA="${SALIDA:-$PWD/manifiesto-${OVERLAY}.yaml}"

# 1. Renderizar manifiestos con la imagen y anotaciones de trazabilidad (sin modificar el repositorio)
TRABAJO="$(mktemp -d)"
cp -r k8s "$TRABAJO/"
pushd "$TRABAJO/k8s/overlays/$OVERLAY" > /dev/null
kustomize edit set image "productos-service=${IMAGE}"
cat >> kustomization.yaml <<EOF
commonAnnotations:
  kubernetes.io/change-cause: "${CAUSA}"
  productos.devops/commit: "${GITHUB_SHA:-local}"
  productos.devops/pipeline: "${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-local}"
EOF
kustomize build . > "$SALIDA"
popd > /dev/null
echo "Manifiesto renderizado: $SALIDA ($(grep -c '^kind:' "$SALIDA") recursos)"

# 2. Namespace y Secrets (las credenciales nunca están en el repositorio)
kubectl apply -f "k8s/overlays/$OVERLAY/namespace.yaml"
if ! kubectl -n "$NS" get secret productos-db > /dev/null 2>&1; then
  PASSWORD="$(openssl rand -hex 24)"
  [[ -n "${GITHUB_ACTIONS:-}" ]] && echo "::add-mask::$PASSWORD"
  kubectl -n "$NS" create secret generic productos-db \
    --from-literal=POSTGRES_DB=productos \
    --from-literal=POSTGRES_USER=productos \
    --from-literal=POSTGRES_PASSWORD="$PASSWORD" \
    --from-literal=DATABASE_URL="postgres://productos:${PASSWORD}@productos-db:5432/productos"
fi
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  kubectl -n "$NS" create secret docker-registry ghcr-pull \
    --docker-server=ghcr.io --docker-username="${GHCR_USER}" --docker-password="${GHCR_TOKEN}" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

revertir() {
  echo "::error::El despliegue falló, revirtiendo"
  kubectl -n "$NS" get pods -o wide || true
  kubectl -n "$NS" describe deployment productos-api | tail -20 || true
  kubectl -n "$NS" logs -l app.kubernetes.io/name=productos-api --tail 30 --prefix || true
  if [[ "$(kubectl -n "$NS" rollout history deployment/productos-api | grep -cE '^[0-9]+')" -gt 1 ]]; then
    kubectl -n "$NS" rollout undo deployment/productos-api
    kubectl -n "$NS" rollout status deployment/productos-api --timeout=180s
    echo "Rollback completado a la revisión anterior"
  else
    echo "Primera versión en este clúster: no hay revisión anterior a la cual volver"
  fi
  exit 1
}

# 3. Aplicar y esperar el rollout
kubectl apply -f "$SALIDA"
kubectl -n "$NS" rollout status statefulset/productos-db --timeout=180s
kubectl -n "$NS" rollout status deployment/productos-api --timeout=240s || revertir
kubectl -n "$NS" rollout history deployment/productos-api

# 4. Pruebas de humo a través del Service
kubectl -n "$NS" port-forward svc/productos-api 8080:80 > /dev/null 2>&1 &
PF=$!
trap 'kill $PF 2> /dev/null || true' EXIT
sleep 3
bash scripts/smoke-test.sh http://localhost:8080 || revertir
