# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-alpine

# ---- Etapa 1: dependencias de producción ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Caché de npm entre builds; --ignore-scripts evita ejecutar scripts de instalación de terceros
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# ---- Etapa 2: imagen final mínima ----
FROM ${NODE_IMAGE} AS runtime

# Metadatos OCI para trazabilidad: qué versión y qué commit contiene la imagen
ARG VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="productos-service" \
      org.opencontainers.image.description="Microservicio REST de catálogo de productos" \
      org.opencontainers.image.source="https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    GIT_SHA=${GIT_SHA}

# Parches de seguridad del sistema base y eliminación de npm/yarn/corepack:
# no se usan en ejecución, reducen el tamaño y la superficie de ataque (y sus vulnerabilidades)
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
# Los archivos quedan como propiedad de root y solo lectura para el usuario que ejecuta la app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Usuario sin privilegios (UID 1000, incluido en la imagen oficial de Node)
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
