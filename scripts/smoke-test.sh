#!/usr/bin/env bash
# Pruebas de humo contra una instancia desplegada del servicio.
# Uso: ./scripts/smoke-test.sh [URL_BASE]   (por defecto http://localhost:3000)
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
FALLOS=0

echo "Esperando a que el servicio responda en ${BASE_URL} ..."
for _ in $(seq 1 30); do
  if curl -fs "${BASE_URL}/health" > /dev/null; then break; fi
  sleep 1
done

verificar() {
  local descripcion="$1" esperado="$2" metodo="$3" ruta="$4" cuerpo="${5:-}"
  local codigo
  if [[ -n "$cuerpo" ]]; then
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -X "$metodo" -H 'Content-Type: application/json' -d "$cuerpo" "${BASE_URL}${ruta}")
  else
    codigo=$(curl -s -o /dev/null -w '%{http_code}' -X "$metodo" "${BASE_URL}${ruta}")
  fi
  if [[ "$codigo" == "$esperado" ]]; then
    echo "  OK    ${descripcion} (${metodo} ${ruta} -> ${codigo})"
  else
    echo "  FALLO ${descripcion} (${metodo} ${ruta} -> ${codigo}, se esperaba ${esperado})"
    FALLOS=$((FALLOS + 1))
  fi
}

echo "Ejecutando pruebas de humo:"
verificar "Health check"             200 GET  /health
verificar "Listar productos"         200 GET  /api/productos
verificar "Obtener producto"         200 GET  /api/productos/1
verificar "Producto inexistente"     404 GET  /api/productos/999
verificar "Crear producto"           201 POST /api/productos '{"nombre":"Smoke","precio":1,"stock":1}'
verificar "Rechazar producto inválido" 400 POST /api/productos '{"nombre":""}'

if [[ $FALLOS -gt 0 ]]; then
  echo "Pruebas de humo fallidas: ${FALLOS}"
  exit 1
fi
echo "Todas las pruebas de humo pasaron."
