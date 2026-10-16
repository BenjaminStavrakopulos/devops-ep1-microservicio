#!/usr/bin/env bash
# Pruebas de humo contra una instancia desplegada del servicio.
# Uso: ./scripts/smoke-test.sh [URL_BASE]   (por defecto http://localhost:3000)
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
FALLOS=0

echo "Esperando a que el servicio esté listo en ${BASE_URL} ..."
for _ in $(seq 1 60); do
  if curl -fs "${BASE_URL}/ready" > /dev/null; then break; fi
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

echo "Información del despliegue:"
echo "  $(curl -s "${BASE_URL}/health")"

echo "Ejecutando pruebas de humo:"
verificar "Liveness"                   200 GET    /health
verificar "Readiness"                  200 GET    /ready
verificar "Listar productos"           200 GET    /api/productos
verificar "Filtrar productos"          200 GET    "/api/productos?categoria=perifericos&ordenar=-precio"
verificar "Obtener producto"           200 GET    /api/productos/1
verificar "Producto inexistente"       404 GET    /api/productos/999
verificar "Rechazar producto inválido" 400 POST   /api/productos '{"nombre":""}'
verificar "Eliminar inexistente"       404 DELETE /api/productos/999

# Consistencia entre réplicas: lo que se crea en una réplica debe verse desde todas
ID=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"nombre":"Smoke test","precio":1,"stock":1}' "${BASE_URL}/api/productos" | sed -nE 's/.*"id":([0-9]+).*/\1/p')
if [[ -z "$ID" ]]; then
  echo "  FALLO Crear producto (no se obtuvo id)"
  FALLOS=$((FALLOS + 1))
else
  echo "  OK    Crear producto (id ${ID})"
  for i in $(seq 1 6); do
    verificar "Leer producto creado (petición ${i})" 200 GET "/api/productos/${ID}"
  done
  verificar "Eliminar producto creado"   204 DELETE "/api/productos/${ID}"
fi

# Balanceo de carga (informativo): cuántas réplicas distintas respondieron
REPLICAS=$(for _ in $(seq 1 15); do
  curl -s -D - -o /dev/null "${BASE_URL}/health" | tr -d '\r' | sed -n 's/^[Xx]-[Uu]pstream: //p'
done | sort -u)
if [[ -n "$REPLICAS" ]]; then
  echo "Réplicas que respondieron en 15 peticiones: $(echo "$REPLICAS" | wc -l)"
  echo "$REPLICAS" | sed 's/^/  - /'
fi

if [[ $FALLOS -gt 0 ]]; then
  echo "Pruebas de humo fallidas: ${FALLOS}"
  exit 1
fi
echo "Todas las pruebas de humo pasaron."
