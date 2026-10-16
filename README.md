# productos-service

[![CI/CD](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/actions/workflows/ci.yml/badge.svg)](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=BenjaminStavrakopulos_devops-ep1-microservicio&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=BenjaminStavrakopulos_devops-ep1-microservicio)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=BenjaminStavrakopulos_devops-ep1-microservicio&metric=coverage)](https://sonarcloud.io/summary/new_code?id=BenjaminStavrakopulos_devops-ep1-microservicio)

Microservicio REST para la gestión de un catálogo de productos (**Node.js + Express + PostgreSQL**), contenerizado con **Docker**, orquestado con **Kubernetes** y **Docker Compose**, y con un pipeline **CI/CD en GitHub Actions** que automatiza todo su ciclo de vida: pruebas, análisis de seguridad, construcción de la imagen y despliegue.

> **Ingeniería DevOps (DOY0101)** – Trabajo realizado en **pareja** por Bastián Lazo y Benjamín Stavrakopulos.
> - **EP1** *Tu primer pipeline de despliegue*: estrategia de ramificación, convenciones y primer pipeline ([ver sección](#evaluación-parcial-1-control-de-versiones-y-colaboración)).
> - **EP2** *Añadiéndole complejidad a nuestro pipeline*: contenedores, pruebas, seguridad, despliegue automático y orquestación (secciones siguientes).

## Contenido

- [Arquitectura](#arquitectura)
- [Ejecución local](#ejecución-local)
- [Pipeline CI/CD](#pipeline-cicd)
- [Contenedores](#contenedores)
- [Orquestación](#orquestación)
- [Seguridad y escalabilidad](#seguridad-y-escalabilidad)
- [Cómo se garantiza la calidad](#cómo-se-garantiza-la-calidad)
- [Cómo se garantiza la trazabilidad](#cómo-se-garantiza-la-trazabilidad)
- [Evidencias](#evidencias)
- [Decisiones técnicas](#decisiones-técnicas)
- [API](#api)
- [Evaluación Parcial 1: control de versiones y colaboración](#evaluación-parcial-1-control-de-versiones-y-colaboración)
- [Documentación](#documentación)
- [Declaración de uso de IA](#declaración-de-uso-de-inteligencia-artificial)
- [Conclusiones y reflexión personal](#conclusiones-y-reflexión-personal)

## Arquitectura

```mermaid
flowchart LR
  subgraph k8s["Kubernetes (namespace productos-staging / productos-production)"]
    svc["Service<br/>productos-api"] --> p1["Pod API"]
    svc --> p2["Pod API"]
    svc -.HPA escala.-> p3["Pod API ..."]
    p1 & p2 & p3 --> db[("StatefulSet<br/>PostgreSQL + PVC")]
  end
  cliente((Cliente)) --> svc
```

- **API sin estado**: todas las réplicas comparten el estado en PostgreSQL, por eso pueden escalar horizontalmente.
- **Repositorio intercambiable**: con `DATABASE_URL` se usa PostgreSQL; sin ella, un repositorio en memoria (desarrollo y pruebas).
- **Endpoints de operación**: `/health` (*liveness*) y `/ready` (*readiness*), más apagado ordenado ante `SIGTERM`, para que el orquestador gestione los pods sin cortar peticiones.

## Ejecución local

**Requisitos:** Node.js 22+ (o Docker).

```bash
git clone https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio.git
cd devops-ep1-microservicio

# Con Node (repositorio en memoria)
npm ci
npm start                 # http://localhost:3000
npm test                  # pruebas unitarias e integración
npm run test:ci           # pruebas + umbral de cobertura + reportes
npm run lint              # análisis estático

# Stack completo con Docker Compose (lb + api x3 + PostgreSQL)
cp .env.example .env      # definir POSTGRES_PASSWORD
docker compose up -d --build --wait
bash scripts/smoke-test.sh
docker compose up -d --scale api=5 --no-recreate   # escalar
docker compose down -v
```

Para Kubernetes local con [kind](https://kind.sigs.k8s.io/), ver [docs/ORQUESTACION.md](docs/ORQUESTACION.md#ejecutar-en-local).

## Pipeline CI/CD

Archivo: [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Se ejecuta en cada **pull request** hacia `develop` o `main`, en cada **push** a `develop` y `main`, y de forma manual (`workflow_dispatch`).

```mermaid
flowchart LR
  subgraph CI["Integración continua (todas las ejecuciones)"]
    direction TB
    commits["Validar commits<br/>(PR)"]
    tests["Lint + tests<br/>Node 22 y 24<br/>umbral de cobertura"]
    sonar["SonarCloud<br/>Quality Gate"]
    secretos["gitleaks<br/>secretos"]
    deps["npm audit<br/>+ Dependency Review (PR)"]
    iac["kubeconform +<br/>Trivy config (IaC)"]
    tests --> sonar
  end
  subgraph IMG["Imagen"]
    build["Build Docker<br/>labels OCI"] --> trivy["Trivy<br/>vulnerabilidades + SBOM"] --> smoke["Smoke test<br/>contenedor endurecido"]
  end
  sonar & secretos & deps --> build
  smoke --> e2e["PR: e2e Docker Compose<br/>PostgreSQL + escalado"]
  smoke --> stg["develop: deploy staging<br/>Kubernetes (kind)"]
  iac --> stg
  smoke --> ghcr["main: publicar en GHCR"] --> prod["deploy production<br/>Kubernetes (kind) por digest"]
  iac --> ghcr
```

| # | Job | Cuándo | Qué hace | Si falla |
|---|-----|--------|----------|----------|
| 1 | Validar convención de commits | PR | Verifica Conventional Commits en todos los commits del PR | Bloquea el PR |
| 2 | Lint y tests (Node 22 y 24) | Siempre | ESLint + **93 pruebas** unitarias e integración, con **umbral de cobertura** obligatorio | Bloquea |
| 3 | Análisis de código (SonarCloud) | Siempre | Bugs, vulnerabilidades, *security hotspots*, *code smells*, duplicación y cobertura; espera el **Quality Gate** | Bloquea |
| 4 | Escaneo de secretos (gitleaks) | Siempre | Busca credenciales en todo el historial | Bloquea |
| 5 | Auditoría de dependencias | Siempre | `npm audit --audit-level=high` y verificación de firmas | Bloquea |
| 6 | Revisión de dependencias del PR | PR | Detecta dependencias nuevas con vulnerabilidades *high* y comenta en el PR | Bloquea el PR |
| 7 | Validación de manifiestos e IaC | Siempre | `kustomize build`, `kubeconform -strict` y `trivy config` sobre Kubernetes y Dockerfile | Bloquea |
| 8 | Build de imagen Docker y smoke test | Siempre (si 2–5 pasan) | Build con labels OCI, **Trivy** (SARIF a *Security*, bloqueo HIGH/CRITICAL), **SBOM**, contenedor endurecido y pruebas de humo | Bloquea el despliegue |
| 9 | Prueba e2e de la orquestación | PR | Stack Docker Compose (Nginx + API x3 + PostgreSQL), pruebas de humo, escalado a 5 réplicas | Bloquea el PR |
| 10 | Deploy a staging (Kubernetes) | Push a `develop` o manual | Clúster kind de 3 nodos, rollout, smoke test, **rollback automático**, pruebas de balanceo, rolling update sin caída y HPA | Rollback |
| 11 | Publicar imagen en GHCR | Push a `main` | Publica **la misma imagen probada** (sin reconstruirla) con tags versión, `sha-*` y `latest` | — |
| 12 | Deploy a production (Kubernetes) | Tras 11 | Igual que staging, descargando la imagen desde GHCR **por digest** | Rollback |
| 13 | Alerta de seguridad | Si falla 3, 4, 5, 7 u 8 en `develop`/`main` | Abre o actualiza un **issue** con la etiqueta `seguridad` | — |

Además, **Dependabot** revisa cada semana las dependencias npm, las GitHub Actions y la imagen base de Docker, y abre PRs hacia `develop`. Las alertas de seguridad de Dependabot, el *secret scanning* y la *push protection* de GitHub están activados.

Detalle de cada etapa y su rol en CI/CD: [docs/CI-CD.md](docs/CI-CD.md).

**Sobre las ejecuciones canceladas y fallidas:** las ejecuciones marcadas como *cancelled* corresponden a la política de `concurrency` (un push nuevo cancela la ejecución anterior de la misma rama). Las ejecuciones *failed* de Dependabot (PRs #24, #25, #26) son esperadas: el bump a ESLint 10 rompía la configuración del proyecto y bloqueaba el merge. Fue resuelto manualmente en el PR #28 (`feature/actualizar-eslint-10`) y agrupado en Dependabot para evitar PRs individuales que rompan el pipeline.

### Flujo por rama y entorno

| Evento | Entorno | Qué se despliega |
|--------|---------|------------------|
| PR hacia `develop`/`main` | Runner efímero | Stack Docker Compose para la prueba e2e (no persiste) |
| Push a `develop` | **staging**: Kubernetes, namespace `productos-staging` | Imagen recién construida (tag = commit) |
| Push a `main` | **production**: Kubernetes, namespace `productos-production` | Imagen publicada en GHCR, referenciada por digest |

Los clústeres son **kind** (Kubernetes en Docker) creados dentro del runner de GitHub Actions: un entorno cloud simulado, efímero y reproducible. Los despliegues quedan registrados en los *environments* `staging` y `production` del repositorio.

## Contenedores

[`Dockerfile`](Dockerfile) multi-etapa sobre `node:22-alpine`:

| Práctica | Para qué |
|----------|----------|
| Multi-etapa (`deps` → `runtime`) con `npm ci --omit=dev --ignore-scripts` | Solo dependencias de producción, sin ejecutar scripts de terceros |
| Caché de npm con BuildKit (`--mount=type=cache`) | Builds más rápidos |
| Se eliminan npm, yarn y corepack de la imagen final; `apk upgrade` | Menos tamaño, menos superficie de ataque y menos CVE |
| Usuario sin privilegios (`USER node`); código como propiedad de root | Un atacante no puede modificar la aplicación |
| `HEALTHCHECK`, `STOPSIGNAL SIGTERM` y apagado ordenado en la app | El runtime sabe si el contenedor está sano y lo detiene sin cortar peticiones |
| Labels OCI `version`, `revision` (commit), `created`, `source` | Trazabilidad: cada imagen indica de qué commit viene |
| `.dockerignore` estricto | Contexto de build mínimo; tests, docs y `.env` no entran a la imagen |
| Imagen final liviana sobre `node:22-alpine` | Menos peso y menos superficie de ataque |

En ejecución, los contenedores corren con **sistema de archivos de solo lectura**, sin *capabilities* de Linux (`drop: ALL`), sin escalada de privilegios, con perfil *seccomp* y con **límites de CPU y memoria**, tanto en Compose como en Kubernetes.

## Orquestación

Dos niveles, cada uno con su propósito (detalle en [docs/ORQUESTACION.md](docs/ORQUESTACION.md)):

### Kubernetes: staging y production

Manifiestos en [`k8s/`](k8s) con **Kustomize** (`base/` + `overlays/staging` y `overlays/production`):

| Recurso | Configuración |
|---------|---------------|
| `Deployment` productos-api | Rolling update `maxSurge: 1`, `maxUnavailable: 0`; probes *startup*, *liveness* (`/health`) y *readiness* (`/ready`); `preStop`; réplicas repartidas entre nodos (`topologySpreadConstraints`) |
| `HorizontalPodAutoscaler` | Escala por CPU (objetivo 70%): **2–4** réplicas en staging y **3–8** en production; subida rápida y bajada estabilizada (120 s) |
| `PodDisruptionBudget` | Mínimo 1 (staging) o 2 (production) réplicas disponibles durante mantenimientos |
| `StatefulSet` PostgreSQL | Volumen persistente (`volumeClaimTemplates`), probes `pg_isready` |
| `NetworkPolicy` | Bloquea todo el ingreso por defecto; solo la API puede conectarse a PostgreSQL |
| `Namespace` | *Pod Security Standards* en modo **restricted** (rechaza pods inseguros) |
| `Secret` | Lo crea el pipeline con una contraseña aleatoria; **no está en el repositorio** |

### Docker Compose: desarrollo local y prueba e2e de cada PR

[`docker-compose.yml`](docker-compose.yml): **Nginx** (balanceador) → **API x3** (escalable con `--scale`) → **PostgreSQL**, con healthchecks, `depends_on: service_healthy`, red de base de datos interna, límites de recursos y contenedores endurecidos.

## Seguridad y escalabilidad

**Parámetros de seguridad ajustados en el pipeline:**

| Capa | Control | Respuesta |
|------|---------|-----------|
| Código | SonarCloud (Quality Gate) | Bloqueo |
| Secretos | gitleaks en CI + secret scanning y push protection de GitHub | Bloqueo |
| Dependencias | Dependabot (alertas + PRs), `npm audit` (*high*), Dependency Review | Alerta + bloqueo |
| Imagen | Trivy: HIGH/CRITICAL con parche disponible; resultados en *Security → Code scanning*; SBOM | Alerta + bloqueo |
| Infraestructura como código | `trivy config` + `kubeconform` sobre manifiestos y Dockerfile | Bloqueo |
| Pipeline | `permissions` mínimos por job, `GITHUB_TOKEN` efímero, versiones de herramientas fijadas | — |
| Despliegue | Credenciales de BD aleatorias por despliegue, Pod Security *restricted*, NetworkPolicy | — |
| Ramas | Protección de `main`/`develop`: 9 checks obligatorios | Bloqueo del merge |
| Cualquier fallo en `develop`/`main` | Job *Alerta de seguridad* | Issue `seguridad` |

La prueba de que los bloqueos funcionan está en el [PR #19](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/19): agregaba `lodash@4.17.20` (CVE-2021-23337, severidad alta), la auditoría y la revisión de dependencias fallaron, no se construyó ni desplegó la imagen y el PR quedó **BLOCKED**. Política completa en [SECURITY.md](SECURITY.md).

**Hallazgo LOW aceptado:** Trivy reporta que la imagen oficial de PostgreSQL usa el UID 70. Es un requisito de esa imagen y está mitigado por el resto de controles (`readOnlyRootFilesystem`, `cap_drop: ALL`, seccomp, NetworkPolicy y Pod Security `restricted`). Documentado como excepción consciente.

**Parámetros de escalabilidad y desempeño:**

| Parámetro | Valor | Dónde |
|-----------|-------|-------|
| Réplicas mínimas / máximas (HPA) | 2–4 staging · 3–8 production | `k8s/overlays/*` |
| Objetivo de CPU del HPA | 70% de `requests.cpu` | `k8s/base/api-hpa.yaml` |
| Requests / limits API | 100m–500m CPU, 96–256 MiB (staging) · 200m–1 CPU, 128–384 MiB (production) | Deployment |
| Conexiones a BD por réplica | 5 (`DB_POOL_MAX`) | ConfigMap |
| Estrategia de actualización | `maxSurge 1` / `maxUnavailable 0` | Deployment |
| Disponibilidad durante mantenimientos | PDB `minAvailable` 1 / 2 | `api-pdb.yaml` |
| Réplicas en Compose | 3 (escalable a N con `--scale`) | `docker-compose.yml` |
| Tamaño máximo de petición | 10 KB (API), 16 KB (Nginx) | `app.js`, `nginx.conf` |

## Cómo se garantiza la calidad

1. **Política de pruebas obligatoria.** 93 pruebas con el test runner nativo de Node:
   - **Unitarias** (`tests/unit/`): validación (valores límite, tipos inválidos), filtros y ordenamiento, repositorio en memoria, repositorio PostgreSQL (contra una base emulada con `pg-mem`) y reintentos.
   - **Integración** (`tests/integration/`): toda la API por HTTP, readiness, apagado, cabeceras de seguridad, límite de tamaño y errores 500 sin filtrar detalles.
   - **Casos críticos**, incluida la regresión del hotfix v1.0.1 (eliminar un id inexistente borraba datos).
   - **Umbral de cobertura** que bloquea el pipeline: **≥90% de líneas, ≥85% de ramas, ≥90% de funciones** (actual: ~98.8% de líneas, ~98% de ramas).
   - Se ejecutan en **Node 22 y 24**; los reportes JUnit y LCOV quedan como artefactos.
2. **Análisis estático.** ESLint (0 errores) y **SonarCloud con Quality Gate**.
3. **Pruebas del artefacto real.** La imagen se prueba como contenedor endurecido; el stack completo con PostgreSQL real se prueba en cada PR (e2e Compose); en Kubernetes se verifican el balanceo, un **rolling update con tráfico continuo y 0 peticiones fallidas**, y el autoescalado.
4. **Despliegue seguro.** Rollout verificado, pruebas de humo después de cada despliegue y **rollback automático** si fallan.
5. **Revisión.** Ningún cambio llega a `develop` o `main` sin un PR con todos los checks en verde (protección de ramas) y la plantilla de PR completa.
6. **Convenciones automatizadas.** Conventional Commits validado en el CI y ramas con naming GitFlow ([guía](docs/GUIA-BUENAS-PRACTICAS.md)).

## Cómo se garantiza la trazabilidad

Cada cambio se puede seguir **desde el commit hasta el pod que lo ejecuta**, y en sentido inverso:

```mermaid
flowchart LR
  A["Issue / PR #N<br/>(plantilla + checks)"] --> B["Commits<br/>Conventional Commits"]
  B --> C["Ejecución del pipeline<br/>(run id, logs, artefactos)"]
  C --> D["Imagen<br/>tag = SHA del commit<br/>labels OCI + SBOM"]
  D --> E["GHCR<br/>versión · sha-xxxxxxx · digest"]
  E --> F["Deployment Kubernetes<br/>change-cause + anotaciones"]
  F --> G["Pod en ejecución<br/>/health → versión, commit, instancia"]
```

| Pregunta | Dónde se responde |
|----------|-------------------|
| ¿Qué PR introdujo este cambio? | `git log --merges`, mensaje `Merge pull request #N`; `gh pr view N` |
| ¿Qué commit y versión están corriendo? | `GET /health` → `version`, `commit`, `instancia` |
| ¿De qué commit viene esta imagen? | Tag `sha-xxxxxxx` en GHCR y label `org.opencontainers.image.revision` |
| ¿Qué componentes contiene la imagen? | Artefacto **SBOM** (CycloneDX) de la ejecución |
| ¿Qué se desplegó, cuándo y desde qué pipeline? | `kubectl rollout history` (`change-cause` con el commit), anotaciones `productos.devops/commit` y `productos.devops/pipeline`, artefacto `manifiesto-<entorno>.yaml` y la pestaña *Deployments* de GitHub |
| ¿Qué cambió entre versiones? | Tags `vX.Y.Z`, [GitHub Releases](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases) y [CHANGELOG](CHANGELOG.md) |
| ¿Qué controles pasó un cambio? | Checks del PR y *Job Summary* de cada ejecución (pruebas, cobertura, imagen, estado del clúster) |

El registro paso a paso del flujo de trabajo está en [docs/TRAZABILIDAD.md](docs/TRAZABILIDAD.md).

## Evidencias

Evidencias de la release [v1.2.0](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.2.0), que integra la EP2:

| Qué se demuestra | Evidencia |
|------------------|-----------|
| Pipeline completo en un PR (12 checks en verde) | [PR #22](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/22) |
| **Bloqueo** por dependencia vulnerable | [PR #19](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/19): auditoría y revisión de dependencias en rojo, sin build ni despliegue, PR **BLOCKED** |
| Calidad del código | [SonarCloud](https://sonarcloud.io/summary/overall?id=BenjaminStavrakopulos_devops-ep1-microservicio): Quality Gate aprobado, 0 bugs, 0 vulnerabilidades, 0 code smells, 0% de duplicación |
| Orquestación con Docker Compose y escalado | [PR #17](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/17), job *Prueba e2e*: las peticiones se repartieron entre **3 réplicas** y luego entre **5** después de escalar |
| Deploy automático a staging en Kubernetes | [Ejecución 38843626839](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/actions/runs/38843626839) (push a `develop`) |
| Balanceo entre pods | Misma ejecución: 40 peticiones repartidas **18 / 22** entre los 2 pods |
| Rolling update sin caída | Misma ejecución: **7.326 peticiones exitosas, 0 fallidas** mientras se reiniciaban todos los pods |
| Autoescalado (HPA) | Misma ejecución: con la CPU al 135%/70%, el HPA escaló de **2 a 4 réplicas** (máximo de staging) en 45 s |
| Publicación en GHCR y deploy a production | [Ejecuciones en `main`](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/actions/workflows/ci.yml?query=branch%3Amain) después del merge de la release |
| Historial de despliegues | [Deployments](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/deployments) (`staging` y `production`) |
| Alertas de seguridad | Pestaña [Security](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/security) (Dependabot, code scanning de Trivy, secret scanning) |
| Versionado | [Releases](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases) y [CHANGELOG](CHANGELOG.md) |
| Protección de ramas en acción | Intento de push directo a `main` rechazado con `GH006: Protected branch update failed`, exigiendo PR y los 9 checks obligatorios |

Cada ejecución del pipeline publica en su *Job Summary* el resultado de las pruebas, la cobertura, los datos de la imagen y el estado del clúster.

## Decisiones técnicas

### ¿Por qué Kubernetes para staging/producción y Docker Compose para local y PRs?

Docker Compose nos da un entorno reproducible en segundos y sin necesidad de un clúster. Es ideal para el desarrollo local y para la prueba que corre en cada PR: levanta Nginx + API ×3 + PostgreSQL, y permite escalar con `--scale` sin instalar nada extra. Kubernetes es el estándar en producción: nos aporta HPA, rolling updates con `maxUnavailable: 0`, PodDisruptionBudget, NetworkPolicy, Pod Security Standards y probes diferenciadas (startup/liveness/readiness). Usamos cada uno donde tiene sentido: Compose para velocidad, Kubernetes para robustez y gobernanza.

### ¿Por qué SonarCloud y no Snyk?

SonarCloud cubre bugs, vulnerabilidades, *security hotspots*, *code smells*, duplicación y cobertura con Quality Gate bloqueante. Snyk se enfoca principalmente en dependencias. Como ya cubrimos dependencias con `npm audit`, Dependency Review, Dependabot y Trivy (imagen + IaC), SonarCloud aporta la capa que ninguna otra herramienta cubre: análisis estático del código propio. Cada herramienta cubre un eslabón distinto de la cadena.

### ¿Por qué bloquear en severidad *high* y no *medium*?

Bloquear en *medium* genera demasiados falsos positivos y fatiga de alertas; en la práctica, eso empuja al equipo a desactivar los bloqueos. Aceptamos el riesgo residual de *medium* porque: (1) las dependencias se actualizan semanalmente con Dependabot, (2) Trivy y SonarCloud siguen reportando esos hallazgos en la pestaña Security aunque no bloqueen, y (3) el equipo revisa los issues de seguridad abiertos periódicamente. La política está declarada en `SECURITY.md`.

### ¿Por qué PostgreSQL y no mantener el estado en memoria?

Con varias réplicas de la API, un estado en memoria se duplica y se desincroniza: lo que se crea en una réplica no lo ve otra. PostgreSQL centraliza el estado y permite que todas las réplicas lean y escriban la misma fuente. El repositorio en memoria queda como *fallback* para desarrollo y pruebas, y se elige con la variable `DATABASE_URL`.

### ¿Por qué esos valores de HPA y requests/limits?

El HPA apunta al 70% de CPU sobre `requests.cpu`: por debajo de ese umbral el sistema tiene margen antes de degradarse, y por encima escala rápido. En staging usamos 2–4 réplicas (bajo costo) y en producción 3–8 (carga real). La subida es agresiva (+2 pods cada 15s) y la bajada tiene una ventana de estabilización de 120s para evitar oscilaciones por picos momentáneos. Los `requests` permiten que el scheduler ubique pods según la capacidad real de los nodos; los `limits` evitan que un pod afecte a sus vecinos.

### ¿Por qué umbral de cobertura 90/85/90?

100% de cobertura es irreal y empuja a escribir tests triviales solo para cumplir la métrica. Con 90% de líneas, 85% de ramas y 90% de funciones cubrimos rutas críticas, casos límite y ramas de error sin volvernos dogmáticos. La cobertura real del proyecto está cerca del 98.8% de líneas, así que el umbral no ahoga al equipo, pero sí bloquea regresiones.

### ¿Por qué publicar la MISMA imagen probada y desplegar por digest?

"Build once, deploy many": reconstruir la imagen en cada entorno introduce diferencias no verificadas. Publicamos exactamente la imagen que ya pasó pruebas, Trivy y smoke test. Desplegamos por digest (`@sha256:...`) en lugar de por tag porque el digest es inmutable: un tag como `latest` puede cambiar sin aviso, un digest no.

### ¿Por qué `preStop: sleep 5` + `terminationGracePeriodSeconds: 30`?

El `preStop` de 5 segundos da tiempo a que el pod salga de los *endpoints* del Service antes de recibir SIGTERM. Los 30 segundos de gracia cubren peticiones lentas, cierre del pool de conexiones y reintentos. Combinado con la `readinessProbe` que responde 503 durante el apagado, evitamos cortar tráfico durante un rolling update o un escalado hacia abajo.

### ¿Por qué `--ignore-scripts` en `npm ci`?

Ejecutar scripts de instalación de dependencias de terceros abre la puerta a ataques de cadena de suministro: un paquete comprometido puede ejecutar código arbitrario durante el build. `--ignore-scripts` desactiva esa ejecución y ninguna de nuestras dependencias de producción la requiere.

### ¿Por qué `readOnlyRootFilesystem` + `cap_drop: ALL` + `seccomp`?

Defensa en capas: si un atacante compromete el contenedor, no puede escribir en el sistema de archivos, no tiene capabilities de Linux ni puede escalar privilegios, y el perfil seccomp restringe las llamadas al sistema. Lo aplicamos tanto en Docker Compose como en Kubernetes.

## API

Variables de entorno:

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | *(vacía → memoria)* | Cadena de conexión a PostgreSQL |
| `DB_POOL_MAX` | `10` | Conexiones máximas por réplica |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Tiempo máximo del apagado ordenado |
| `GIT_SHA` | `local` | Commit desplegado (lo inyecta el pipeline en la imagen) |

| Método | Ruta                  | Descripción                     |
|--------|-----------------------|---------------------------------|
| GET    | `/health`             | *Liveness*: estado, versión, commit, instancia y tipo de almacenamiento |
| GET    | `/ready`              | *Readiness*: `200` si puede recibir tráfico, `503` si la base de datos no responde o se está apagando |
| GET    | `/api/productos`      | Lista productos (con filtros)   |
| GET    | `/api/productos/:id`  | Obtiene un producto por id      |
| POST   | `/api/productos`      | Crea un producto                |
| PUT    | `/api/productos/:id`  | Reemplaza un producto           |
| PATCH  | `/api/productos/:id`  | Actualiza campos de un producto |
| DELETE | `/api/productos/:id`  | Elimina un producto             |

Ejemplo de producto:

```json
{ "id": 1, "nombre": "Teclado mecánico", "categoria": "perifericos", "precio": 45990, "stock": 12 }
```

`GET /api/productos` acepta los siguientes filtros opcionales (combinables):

| Parámetro   | Ejemplo            | Descripción                                   |
|-------------|--------------------|-----------------------------------------------|
| `categoria` | `?categoria=audio` | Filtra por categoría (sin distinguir mayúsculas) |
| `q`         | `?q=teclado`       | Busca el texto dentro del nombre              |
| `precioMin` | `?precioMin=10000` | Precio mínimo                                 |
| `precioMax` | `?precioMax=50000` | Precio máximo                                 |
| `ordenar`   | `?ordenar=-precio` | Ordena por `nombre`, `precio` o `stock` (prefijo `-` = descendente) |

---

## Evaluación Parcial 1: control de versiones y colaboración

### Estrategia de ramificación

#### Modelos de ramificación evaluados

| Modelo | Ramas | Cómo funciona | Ventajas en equipos cloud | Desventajas | Contexto ideal |
|--------|-------|---------------|---------------------------|-------------|----------------|
| **GitFlow** | `main`, `develop`, `feature/*`, `release/*`, `hotfix/*` | Las funcionalidades se integran en `develop`; las versiones se estabilizan en `release/*` y llegan a `main` etiquetadas; los errores urgentes de producción se corrigen en `hotfix/*`. | Separa claramente producción, integración y desarrollo; permite tener un entorno *staging* (`develop`) y otro *production* (`main`); soporta versiones numeradas y parches sin arrastrar trabajo incompleto. | Más ramas y merges; las ramas largas pueden generar conflictos; el ciclo de entrega es más lento. | Productos con versiones planificadas, varios entornos o necesidad de mantener versiones en producción. |
| **GitHub Flow** | `main` + ramas de corta vida | Se crea una rama desde `main`, se abre un PR, se revisa, se mergea y se despliega de inmediato. | Muy simple; favorece despliegues frecuentes; encaja directo con PRs y GitHub Actions. | Un solo entorno de referencia; no hay un lugar natural para estabilizar una versión ni para hacer hotfixes de versiones antiguas. | Aplicaciones web/SaaS con despliegue continuo y equipos pequeños. |
| **GitLab Flow** | `main` + ramas de entorno (`staging`, `production`) o de versión | Como GitHub Flow, pero los cambios "fluyen" de `main` hacia ramas que representan entornos. | Mapea las ramas a los entornos cloud; es más simple que GitFlow. | Requiere disciplina para propagar los cambios en un solo sentido. | Equipos con entornos de despliegue fijos (dev → staging → prod). |
| **Trunk-based development** | `main` (trunk) + ramas de horas o 1–2 días | Todos integran en el trunk varias veces al día; lo incompleto se oculta con *feature flags*. | Integración realmente continua, casi sin conflictos de merge; es el modelo de los equipos DevOps de alto rendimiento. | Exige muy buena cobertura de pruebas, CI rápida, *feature flags* y madurez del equipo. | Equipos con CI/CD maduro que despliegan varias veces al día. |

#### Modelo elegido: GitFlow

```mermaid
gitGraph
  commit id: "inicial"
  branch develop
  checkout develop
  branch feature/pipeline-ci
  commit id: "ci"
  checkout develop
  merge feature/pipeline-ci
  branch feature/crud-productos
  commit id: "crud"
  checkout develop
  merge feature/crud-productos
  branch feature/filtros-busqueda
  commit id: "filtros"
  checkout develop
  merge feature/filtros-busqueda
  branch release/1.0.0
  commit id: "1.0.0"
  checkout main
  merge release/1.0.0 tag: "v1.0.0"
  checkout develop
  merge release/1.0.0
  checkout main
  branch hotfix/x
  commit id: "fix"
  checkout main
  merge hotfix/x tag: "v1.0.1"
  checkout develop
  merge hotfix/x
```

| Rama | Rol | Entorno asociado en el pipeline |
|------|-----|---------------------------------|
| `main` | Producción, solo versiones etiquetadas | `production` → imagen en GHCR + Kubernetes |
| `develop` | Integración de la próxima versión | `staging` → Kubernetes |
| `feature/*` | Una funcionalidad por rama | CI + e2e Compose en el PR |
| `release/*` | Estabilizar y versionar | CI en el PR hacia `main` |
| `hotfix/*` | Corrección urgente de producción | CI en el PR hacia `main` |

#### Justificación de la elección

Elegimos **GitFlow** sobre las otras alternativas por razones concretas de nuestro proyecto:

**Frente a GitHub Flow:** GitHub Flow despliega cada merge a `main` directo a producción. Es atractivo para SaaS con feature flags, pero no da red de seguridad cuando separas staging de producción: un cambio roto llega a prod sin pasar por staging. Con GitFlow, `develop` alimenta staging y `main` alimenta producción, con releases explícitas entre medio.

**Frente a trunk-based development:** trunk-based exige integrar en `main` varias veces al día, ocultar trabajo incompleto con feature flags y tener una CI ultrarrápida. En un trabajo en pareja, con releases semanales y sin feature flags, ese modelo agrega complejidad sin beneficio. La integración continua la cubrimos con 9 checks obligatorios en cada PR.

**Frente a GitLab Flow:** GitLab Flow crea ramas por entorno (`staging`, `production`). Eso amarra la estructura del repositorio a la infraestructura y complica tener dos entornos apuntando a la misma rama de código. Preferimos ramas por tipo de trabajo (`feature/*`, `release/*`, `hotfix/*`), que reflejan el ciclo de vida del cambio y no su destino de despliegue.

**Evidencia propia:** el hotfix v1.0.1 (`DELETE` de un id inexistente borraba el último producto) se corrigió en `hotfix/*`, se mergeó a `main` para producción y luego se hizo back-merge a `develop`. Ese es exactamente el caso de uso que justifica GitFlow: corregir producción sin arrastrar trabajo incompleto de `develop`. Con GitHub Flow, la corrección habría tenido que esperar al siguiente ciclo.

**Límite honesto:** GitFlow tiene un costo: más ramas, más merges, más disciplina. Si el equipo creciera y adoptara feature flags con una CI más rápida, migraríamos a trunk-based. Hoy, para dos personas con releases semanales, GitFlow es lo que mejor nos calza.

### Control de versiones y releases

El proyecto usa **Versionado Semántico** (`MAJOR.MINOR.PATCH`). Cada integración a `main` se publica con un **tag anotado**, un **GitHub Release** y una entrada en el [CHANGELOG](CHANGELOG.md). La versión también aparece en `GET /health` y en la etiqueta de la imagen Docker.

| Versión | Tipo | Llegó a `main` por | Contenido |
|---------|------|--------------------|-----------|
| [v1.0.0](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.0) | MAJOR (primera versión estable) | `release/1.0.0` ([#5](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/5)) | CRUD, filtros, pipeline CI/CD, documentación |
| [v1.0.1](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.1) | PATCH | `hotfix/eliminar-producto-inexistente` ([#7](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/7)) | Corrección: `DELETE` de un id inexistente borraba el último producto |
| [v1.0.2](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.2) | PATCH | `release/1.0.2` ([#10](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/10)) | Documentación de trazabilidad |
| [v1.1.0](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.1.0) | MINOR | `release/1.1.0` ([#13](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/13)) | Escaneo de secretos en el pipeline y documentación de credenciales |
| [v1.2.0](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.2.0) | MINOR | `release/1.2.0` ([#23](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/23)) | **EP2**: PostgreSQL, pruebas con umbral de cobertura, seguridad en el pipeline, Docker Compose y Kubernetes |
| [v1.2.1](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.2.1) | PATCH | `release/1.2.1` | Mantenimiento: ESLint 10 y agrupación en Dependabot |

```bash
git tag -l -n1                     # tags con su mensaje
gh release list                    # releases publicados
git log v1.0.0..v1.0.1 --oneline   # qué cambió entre dos versiones
```

El proceso para crear una release está en la [guía de buenas prácticas](docs/GUIA-BUENAS-PRACTICAS.md#6-control-de-versiones-y-releases). Todas las ramas `release/*` y `hotfix/*` usadas se conservan en el repositorio como evidencia.

### Convenciones del repositorio

Resumen (el detalle está en la [guía de buenas prácticas](docs/GUIA-BUENAS-PRACTICAS.md)):

- **Ramas:** `<tipo>/<descripcion-en-kebab-case>`, por ejemplo `feature/filtros-busqueda` o `hotfix/eliminar-producto-inexistente`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/), por ejemplo `feat(productos): agregar filtro por categoría`. El pipeline lo valida automáticamente.
- **Merge:** siempre por pull request con *merge commit*; `release/*` y `hotfix/*` se integran en `main` **y** en `develop`.
- **Revisión:** CI en verde + checklist de la plantilla de PR + 1 aprobación (en equipo).
- **Versionado:** SemVer, tags `vX.Y.Z`, GitHub Releases y [CHANGELOG.md](CHANGELOG.md).

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/CI-CD.md](docs/CI-CD.md) | Cada etapa del pipeline, su rol en CI/CD y manejo de credenciales |
| [docs/ORQUESTACION.md](docs/ORQUESTACION.md) | Kubernetes y Docker Compose: recursos, escalado, estabilidad y ejecución local |
| [docs/TRAZABILIDAD.md](docs/TRAZABILIDAD.md) | Registro del flujo GitFlow: comandos, PRs, tags y cómo rastrear cada cambio |
| [docs/GUIA-BUENAS-PRACTICAS.md](docs/GUIA-BUENAS-PRACTICAS.md) | Naming de ramas, commits, flujos de merge, revisión, versionado, estructura de carpetas |
| [SECURITY.md](SECURITY.md) | Política de seguridad y controles automáticos |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Pasos rápidos para contribuir |

## Declaración de uso de Inteligencia Artificial

De acuerdo con las indicaciones de la evaluación y la [guía de citación de IA de Bibliotecas Duoc UC](https://bibliotecas.duoc.cl/ia), declaramos lo siguiente:

### Cómo trabajamos

El proyecto lo diseñamos, construimos y validamos nosotros. La IA la usamos como **herramienta de apoyo puntual**, principalmente para resolver errores concretos, entender comportamientos inesperados del pipeline y agilizar tareas repetitivas de documentación. Las decisiones de arquitectura, las estrategias (GitFlow, contenedores, seguridad, orquestación) y las justificaciones técnicas salieron de nuestro criterio y del trabajo iterativo en el repositorio.

### Contexto

El microservicio base (`productos-service`) lo desarrollamos durante la Evaluación Parcial 1. En la EP2 el alcance creció bastante: contenedores, orquestación con Kubernetes, pipeline CI/CD de 13 jobs, pruebas automatizadas con umbral de cobertura, cinco herramientas de seguridad y despliegue automatizado. Todo ese trabajo lo hicimos nosotros, iterando en el repositorio: cada cambio pasó por un PR con revisión y por los 9 checks obligatorios antes de mergearse. La IA nos acompañó en momentos específicos, sobre todo cuando algo fallaba y necesitábamos una segunda mirada para encontrar la causa.

### Uso puntual de IA

| Evaluación | Herramienta | En qué nos apoyó |
|------------|-------------|------------------|
| EP1 | Claude Code (Anthropic, Claude Opus 5.5), octubre 2026 | Correcciones puntuales en el código base del microservicio, ajustes al workflow inicial de GitHub Actions, al Dockerfile, y redacción descriptiva de documentación técnica. |
| EP2 | Claude Code (Anthropic, Claude Opus 5.5), octubre 2026 | Apoyo en la corrección de errores puntuales del pipeline y de la configuración de Kubernetes, ajustes en las pruebas y en el Dockerfile, y redacción descriptiva de la documentación técnica (README, CI-CD, ORQUESTACION). |

### Qué hicimos sin IA

- El **diseño del pipeline** y su orden de jobs.
- Las **decisiones técnicas** de la sección *Decisiones técnicas*.
- La **elección de GitFlow** y su justificación.
- Las **conclusiones y reflexiones personales** de cada integrante (EP1 y EP2).
- La **implementación de cada cambio**: escritura de manifiestos, scripts, tests, workflow, PRs, resolución de conflictos y merges.

Esas secciones las escribimos nosotros, sin apoyo de IA, como exige la pauta.

### Validación y autoría

Todo lo que pasó por apoyo de IA lo revisamos, probamos y validamos antes de integrarlo. Nada entró al repositorio sin pasar por un PR y por los checks obligatorios. La evidencia está en el repo:

- **68 ejecuciones del pipeline** con resultados verificables.
- **PR #19 bloqueado** por una dependencia vulnerable (CVE-2021-23337), mostrando que los controles funcionan.
- **PR #22** con los 12 checks en verde.
- **93 pruebas automatizadas** con ~98.8% de cobertura de líneas.
- **Branch protection** en `main` y `develop`: rechaza push directo y exige PR con 9 checks obligatorios.
- **Hotfix v1.0.1** corregido en producción sin arrastrar trabajo de `develop`.

Ambos asumimos la autoría del proyecto y respondemos por su funcionamiento y por entender cada decisión técnica.

### Cita sugerida (formato APA)

Anthropic. (2026). *Claude Code* (Claude Opus 5.5) [Modelo de lenguaje de gran tamaño]. https://claude.com/claude-code

## Conclusiones y reflexión personal

### EP1

#### Reflexión de Bastián Lazo

> *(Escribe aquí tu reflexión personal, sin apoyo de IA.)*

#### Reflexión de Benjamín Stavrakopulos

> *(Escribe aquí tu reflexión personal, sin apoyo de IA.)*

### EP2

#### Reflexión de Bastián Lazo

> *(Escribe aquí tu reflexión personal, sin apoyo de IA.)*

#### Reflexión de Benjamín Stavrakopulos

> *(Escribe aquí tu reflexión personal, sin apoyo de IA.)*

## Autores

- **Bastián Lazo** – [@BastianLazo](https://github.com/BastianLazo)
- **Benjamín Stavrakopulos** – [@BenjaminStavrakopulos](https://github.com/BenjaminStavrakopulos)
