#!/usr/bin/env bash
# Despliega el stack completo con Docker Compose (lb + api x3 + PostgreSQL), lo valida con pruebas de humo
# y prueba el escalado horizontal a 5 réplicas. Lo usan los jobs "e2e-compose" (PR) y "deploy-staging" (develop).
#
# Requiere: IMAGE (imagen ya cargada en Docker) y POSTGRES_PASSWORD.
set -euo pipefail

: "${IMAGE:?Definir IMAGE}"
: "${POSTGRES_PASSWORD:?Definir POSTGRES_PASSWORD}"
URL="http://localhost:${LB_PORT:-3000}"

echo "::group::Validar configuración"
docker compose config --quiet
echo "::endgroup::"

echo "::group::Desplegar stack"
docker compose up -d --no-build --wait --wait-timeout 180
docker compose ps
echo "::endgroup::"

bash scripts/smoke-test.sh "$URL"

echo "::group::Escalar la API a 5 réplicas"
docker compose up -d --no-build --no-recreate --scale api=5 --wait --wait-timeout 120
docker compose ps api
echo "::endgroup::"

# Nginx vuelve a resolver el DNS cada 5 s: se espera a que incorpore las réplicas nuevas
sleep 6
bash scripts/smoke-test.sh "$URL"
