# Orquestación de contenedores

El servicio se orquesta en dos niveles:

| Herramienta | Uso | Archivos |
|-------------|-----|----------|
| **Kubernetes** | Entornos `staging` y `production`, desplegados automáticamente por el pipeline | [`k8s/`](../k8s) |
| **Docker Compose** | Desarrollo local y prueba e2e de cada pull request | [`docker-compose.yml`](../docker-compose.yml), [`nginx/nginx.conf`](../nginx/nginx.conf) |

## Kubernetes

### Estructura (Kustomize)

```
k8s/
├── kind-config.yaml            # clúster local: 1 control-plane + 2 workers
├── base/                       # recursos comunes
│   ├── kustomization.yaml
│   ├── serviceaccount.yaml     # sin token de la API de Kubernetes
│   ├── configmap.yaml          # configuración no sensible
│   ├── postgres.yaml           # StatefulSet + Service headless
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── api-hpa.yaml
│   ├── api-pdb.yaml
│   └── networkpolicy.yaml
└── overlays/
    ├── staging/                # namespace productos-staging
    └── production/             # namespace productos-production
```

Kustomize permite tener **una sola definición** de los recursos y aplicar por entorno solo las diferencias (réplicas, límites, escalado, origen de la imagen), sin duplicar YAML.

| Parámetro | staging | production |
|-----------|---------|------------|
| Réplicas iniciales de la API | 2 | 3 |
| HPA (mín–máx) | 2–4 | 3–8 |
| Requests / limits de CPU | 100m / 500m | 200m / 1 |
| Requests / limits de memoria | 96Mi / 256Mi | 128Mi / 384Mi |
| PodDisruptionBudget | `minAvailable: 1` | `minAvailable: 2` |
| Volumen de PostgreSQL | 1Gi | 5Gi |
| Origen de la imagen | Artefacto del build (cargado en kind) | GHCR, por digest, con `imagePullSecret` |

### Funcionamiento estable

| Mecanismo | Configuración | Qué evita |
|-----------|---------------|-----------|
| **startupProbe** | `/health` cada 2 s, hasta 60 s | Que el pod se reinicie mientras arranca y reintenta conectar a la base de datos |
| **livenessProbe** | `/health` cada 10 s | Procesos colgados: Kubernetes reinicia el contenedor |
| **readinessProbe** | `/ready` cada 5 s (verifica la BD) | Enviar tráfico a un pod sin base de datos o que se está apagando |
| **Rolling update** | `maxSurge: 1`, `maxUnavailable: 0` | Perder capacidad durante un despliegue |
| **preStop + apagado ordenado** | `sleep 5` y luego `SIGTERM` → la app deja de estar *ready*, termina las peticiones y cierra el pool | Peticiones cortadas durante rolling updates o al escalar hacia abajo |
| **Reintentos de conexión** | Espera exponencial (hasta 10 intentos) en el arranque | Fallos si la API arranca antes que PostgreSQL |
| **Advisory lock** | `pg_advisory_lock` al inicializar el esquema | Datos duplicados o errores cuando varias réplicas arrancan a la vez |
| **topologySpreadConstraints** | Reparte las réplicas entre nodos | Que la caída de un nodo deje el servicio sin réplicas |
| **PodDisruptionBudget** | Réplicas mínimas disponibles | Que un mantenimiento (drain) baje todas las réplicas |
| **Rollback automático** | `kubectl rollout undo` si el rollout o las pruebas de humo fallan | Dejar una versión rota desplegada |

### Escalabilidad

- La API es **sin estado**: el estado está en PostgreSQL, así que cualquier réplica puede atender cualquier petición.
- **HorizontalPodAutoscaler** (`autoscaling/v2`): mantiene la CPU promedio cerca del 70% de `requests.cpu`.
  - Subida: hasta +2 pods cada 15 s, sin ventana de estabilización, para reaccionar rápido a picos.
  - Bajada: −1 pod cada 30 s después de 120 s de carga baja, para evitar oscilaciones.
- `requests` permite que el *scheduler* ubique los pods según la capacidad real de los nodos, y `limits` evita que un pod afecte a los demás.
- PostgreSQL corre como una sola instancia (StatefulSet). Para alta disponibilidad de la base de datos se usaría un operador como CloudNativePG o un servicio administrado; queda fuera del alcance del proyecto.

### Seguridad

- **Pod Security Standards `restricted`** en los namespaces: Kubernetes rechaza cualquier pod que no cumpla el perfil.
- Todos los contenedores: `runAsNonRoot`, UID sin privilegios, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`.
- **NetworkPolicy**: se deniega todo el ingreso por defecto, la API acepta HTTP en el 3000 y PostgreSQL solo acepta conexiones desde los pods de la API.
- **ServiceAccount** sin token montado: la API no puede llamar a la API de Kubernetes.
- **Secrets** generados por el pipeline con una contraseña aleatoria en cada despliegue; nunca se guardan en el repositorio.
- Los manifiestos se validan en cada ejecución con `kubeconform` (esquema) y `trivy config` (malas prácticas de seguridad; bloquea en HIGH/CRITICAL). Hallazgos LOW aceptados: PostgreSQL usa el UID 70 que define su imagen oficial.

### Despliegue en el pipeline

[`scripts/desplegar-k8s.sh`](../scripts/desplegar-k8s.sh):

1. Renderiza el overlay con la imagen exacta (`kustomize edit set image`) y anotaciones de trazabilidad (`kubernetes.io/change-cause`, `productos.devops/commit`, `productos.devops/pipeline`).
2. Crea el namespace, el Secret de la base de datos y, en production, el Secret para descargar la imagen desde GHCR.
3. `kubectl apply` y espera el rollout de PostgreSQL y de la API.
4. Ejecuta las pruebas de humo a través del Service.
5. Si el paso 3 o el 4 fallan: muestra el diagnóstico y hace **rollback** a la revisión anterior.

Luego [`scripts/pruebas-k8s.sh`](../scripts/pruebas-k8s.sh) verifica la orquestación con pods cliente dentro del clúster:

| Prueba | Cómo | Criterio |
|--------|------|----------|
| Balanceo | 40 peticiones al Service | Deben responder al menos 2 pods distintos (bloqueante) |
| Rolling update sin caída | `kubectl rollout restart` mientras un pod envía tráfico continuo durante 75 s | **0 peticiones fallidas** (bloqueante) |
| Autoescalado | 3 pods generan carga durante 150 s mientras se observa el HPA | Se registra el máximo de réplicas alcanzado (informativo) |

Los resultados quedan en el *Job Summary* de cada ejecución.

### Ejecutar en local

Requiere Docker, [kind](https://kind.sigs.k8s.io/), `kubectl` y `kustomize`.

```bash
docker build -t productos-service:local .
kind create cluster --name productos --config k8s/kind-config.yaml
kind load docker-image productos-service:local --name productos

# metrics-server (necesario para el HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/v0.8.1/components.yaml
kubectl -n kube-system patch deployment metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

OVERLAY=staging IMAGE=productos-service:local bash scripts/desplegar-k8s.sh
OVERLAY=staging bash scripts/pruebas-k8s.sh

kubectl -n productos-staging get pods,hpa -o wide
kubectl -n productos-staging port-forward svc/productos-api 8080:80   # http://localhost:8080
kind delete cluster --name productos
```

## Docker Compose

```
cliente ──> lb (Nginx :3000) ──> api x3 ──> db (PostgreSQL)
            red "frontend"                 red "backend" (internal: sin salida a internet)
```

| Servicio | Imagen | Configuración destacada |
|----------|--------|-------------------------|
| `lb` | `nginxinc/nginx-unprivileged:1.28-alpine` | Balanceo *round-robin*; `resolve` vuelve a consultar el DNS cada 5 s, así incorpora las réplicas nuevas sin reiniciarse; `proxy_next_upstream` reintenta en otra réplica si una falla; cabecera `X-Upstream` para verificar el balanceo |
| `api` | `productos-service` | `deploy.replicas: 3` (variable `API_REPLICAS`), límites de CPU y memoria, healthcheck sobre `/ready`, `stop_grace_period: 15s` |
| `db` | `postgres:17-alpine` | Volumen persistente, healthcheck `pg_isready`, contraseña obligatoria por variable de entorno |

Todos los servicios: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `restart: unless-stopped` y `depends_on` con `condition: service_healthy`, para que cada servicio arranque recién cuando su dependencia está sana.

El job **Prueba e2e de la orquestación** ([`scripts/desplegar-compose.sh`](../scripts/desplegar-compose.sh)) levanta este stack en cada PR, corre las pruebas de humo (incluida la consistencia de datos entre réplicas), escala a 5 réplicas y vuelve a probar.
