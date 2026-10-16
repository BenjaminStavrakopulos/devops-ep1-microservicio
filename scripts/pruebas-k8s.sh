#!/usr/bin/env bash
# Pruebas de la orquestación en Kubernetes sobre un despliegue ya realizado:
#   1. Balanceo: las peticiones al Service se reparten entre los pods.
#   2. Rolling update sin caída: se reinician todos los pods mientras se envía tráfico continuo.
#   3. Autoescalado (HPA): se genera carga y se observa cómo aumentan las réplicas.
# Escribe un resumen en $GITHUB_STEP_SUMMARY si existe.
#
# Uso: OVERLAY=staging ./scripts/pruebas-k8s.sh
set -euo pipefail

: "${OVERLAY:?Definir OVERLAY}"
NS="productos-${OVERLAY}"
RESUMEN="${GITHUB_STEP_SUMMARY:-/dev/null}"
URL="http://productos-api.${NS}.svc.cluster.local"

# Pod cliente que cumple el perfil "restricted" de Pod Security del namespace
cliente() {
  local nombre="$1" script="$2"
  kubectl -n "$NS" delete pod "$nombre" --ignore-not-found --wait=true > /dev/null
  kubectl -n "$NS" apply -f - > /dev/null <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: ${nombre}
  labels: { app.kubernetes.io/name: cliente-pruebas }
spec:
  restartPolicy: Never
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10002
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: cliente
      image: curlimages/curl:8.11.1
      command: ["sh", "-c", $(printf '%s' "$script" | jq -Rs .)]
      resources:
        requests: { cpu: 50m, memory: 16Mi }
        limits: { cpu: 500m, memory: 64Mi }
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: [ALL] }
EOF
}

esperar_fin() {
  kubectl -n "$NS" wait --for=jsonpath='{.status.phase}'=Succeeded "pod/$1" --timeout="${2:-180s}" > /dev/null
}

echo "## Pruebas de orquestación en Kubernetes (${OVERLAY})" >> "$RESUMEN"

# --- 1. Balanceo entre pods ---------------------------------------------------
echo "::group::1. Balanceo de carga del Service"
cliente balanceo "for i in \$(seq 1 40); do curl -s ${URL}/health; echo; done"
esperar_fin balanceo 120s
DISTRIBUCION="$(kubectl -n "$NS" logs balanceo | grep -o '"instancia":"[^"]*"' | cut -d'"' -f4 | sort | uniq -c)"
echo "$DISTRIBUCION"
PODS_DISTINTOS="$(echo "$DISTRIBUCION" | grep -c . || true)"
echo "::endgroup::"
{
  echo "### 1. Balanceo del Service"
  echo "40 peticiones repartidas entre **${PODS_DISTINTOS} pods**:"
  echo '```'; echo "$DISTRIBUCION"; echo '```'
} >> "$RESUMEN"
if [[ "$PODS_DISTINTOS" -lt 2 ]]; then
  echo "::error::El tráfico no se repartió entre varias réplicas"
  exit 1
fi

# --- 2. Rolling update sin caída ---------------------------------------------
echo "::group::2. Rolling update con tráfico continuo"
cliente trafico "ok=0; err=0; fin=\$((\$(date +%s) + 75)); \
  while [ \$(date +%s) -lt \$fin ]; do \
    if curl -fs -o /dev/null --max-time 3 ${URL}/api/productos; then ok=\$((ok+1)); else err=\$((err+1)); fi; \
  done; echo \"ok=\$ok err=\$err\""
kubectl -n "$NS" wait --for=condition=Ready pod/trafico --timeout=60s > /dev/null
sleep 5
kubectl -n "$NS" annotate deployment/productos-api kubernetes.io/change-cause="prueba de rolling update sin caída" --overwrite > /dev/null
kubectl -n "$NS" rollout restart deployment/productos-api
kubectl -n "$NS" rollout status deployment/productos-api --timeout=180s
esperar_fin trafico 150s
RESULTADO="$(kubectl -n "$NS" logs trafico | tail -1)"
echo "$RESULTADO"
echo "::endgroup::"
OK="$(echo "$RESULTADO" | sed -nE 's/ok=([0-9]+).*/\1/p')"
ERR="$(echo "$RESULTADO" | sed -nE 's/.*err=([0-9]+)/\1/p')"
{
  echo "### 2. Rolling update sin caída"
  echo "Se reiniciaron todos los pods mientras se enviaba tráfico continuo durante 75 s."
  echo ""
  echo "| Peticiones exitosas | Peticiones fallidas |"
  echo "|---|---|"
  echo "| ${OK} | ${ERR} |"
} >> "$RESUMEN"
if [[ "${ERR:-1}" -gt 0 ]]; then
  echo "::error::Hubo ${ERR} peticiones fallidas durante el rolling update"
  exit 1
fi

# --- 3. Autoescalado horizontal ----------------------------------------------
echo "::group::3. Autoescalado (HPA) bajo carga"
MIN="$(kubectl -n "$NS" get hpa productos-api -o jsonpath='{.spec.minReplicas}')"
MAX="$(kubectl -n "$NS" get hpa productos-api -o jsonpath='{.spec.maxReplicas}')"
for i in 1 2 3; do
  cliente "carga-$i" "fin=\$((\$(date +%s) + 150)); \
    while [ \$(date +%s) -lt \$fin ]; do \
      curl -s -o /dev/null ${URL}/api/productos?ordenar=-precio & curl -s -o /dev/null ${URL}/api/productos?q=a & wait; \
    done"
done
MAXIMO=0
HISTORIAL=""
for t in $(seq 15 15 150); do
  sleep 15
  USO="$(kubectl -n "$NS" get hpa productos-api -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}')"
  ACTUALES="$(kubectl -n "$NS" get deployment productos-api -o jsonpath='{.status.replicas}')"
  ESTADO="${USO:-?}%/70% (${ACTUALES} réplicas)"
  [[ "$ACTUALES" -gt "$MAXIMO" ]] && MAXIMO="$ACTUALES"
  echo "t=${t}s  uso CPU/objetivo: ${ESTADO}"
  HISTORIAL+="| ${t}s | ${ESTADO} |"$'\n'
done
kubectl -n "$NS" delete pod carga-1 carga-2 carga-3 --ignore-not-found --wait=false > /dev/null
echo "::endgroup::"
{
  echo "### 3. Autoescalado horizontal (HPA)"
  echo "Rango configurado: ${MIN}–${MAX} réplicas, objetivo 70% de CPU. **Réplicas máximas alcanzadas: ${MAXIMO}**"
  echo ""
  echo "| Tiempo | CPU actual/objetivo (réplicas) |"
  echo "|---|---|"
  echo -n "$HISTORIAL"
} >> "$RESUMEN"
if [[ "$MAXIMO" -le "$MIN" ]]; then
  # No bloquea: depende de la CPU disponible en el runner, pero queda registrado
  echo "::warning::El HPA no aumentó las réplicas durante la prueba de carga"
fi

kubectl -n "$NS" delete pod balanceo trafico --ignore-not-found --wait=false > /dev/null
echo "Pruebas de orquestación completadas"
