# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.2] - 2026-10-16

### Documentación
- README completo con autoría en pareja (Bastián Lazo y Benjamín Stavrakopulos).
- Sección *Decisiones técnicas* con las justificaciones de cada elección.
- Justificación de la elección de GitFlow frente a otros modelos.
- Declaración de uso de IA reescrita con el alcance real.
- Reflexiones personales de EP1 y EP2 de cada integrante.
- Evidencias adicionales: tamaño de imagen, runs cancelled/failed, hallazgo LOW aceptado y branch protection.

## [1.2.1] - 2026-10-16

### Mantenimiento
- `eslint` y `@eslint/js` actualizados a la versión 10, juntos por ser peer dependencies (#28). Reemplaza los PRs de Dependabot #24 y #25, que fallaban por separado.
- Grupo `eslint` en Dependabot para proponer ambos paquetes en un solo PR (#28).

## [1.2.0] - 2026-10-16

### Agregado
- Persistencia en PostgreSQL seleccionable por `DATABASE_URL`, con inicialización segura entre réplicas (advisory lock) y restricciones en la base de datos (#16).
- Endpoint `/ready` (readiness), apagado ordenado ante `SIGTERM`, reintentos de conexión con espera exponencial, cabeceras de seguridad (helmet) y límite de 10 KB por petición (#16, #20).
- `/health` informa commit, instancia y tipo de almacenamiento (#16, #20).
- Pruebas unitarias separadas de las de integración y umbral de cobertura obligatorio (90/85/90) (#15).
- Dockerfile optimizado: labels OCI, caché de BuildKit, sin npm/yarn en la imagen final (#17).
- Orquestación con Docker Compose: Nginx + API x3 + PostgreSQL, con prueba e2e en cada PR (#17).
- Orquestación con Kubernetes (Kustomize): Deployment, HPA, PDB, StatefulSet, NetworkPolicy y Pod Security *restricted*; deploy automático a staging y production con rollback (#20).
- Seguridad en el pipeline: Dependabot, `npm audit`, Dependency Review, Trivy (imagen e IaC), SBOM, kubeconform y alertas por issue (#18, #20).
- Análisis de código con SonarCloud y Quality Gate bloqueante (#21).

### Documentación
- README con el pipeline, la calidad y la trazabilidad; `docs/ORQUESTACION.md`; `docs/CI-CD.md` y guía actualizados (#22).

## [1.1.0] - 2026-10-15

### Agregado
- Escaneo de secretos con gitleaks en el pipeline: revisa todo el historial y bloquea el build si encuentra credenciales (#12).

### Documentación
- Manejo de credenciales con GitHub Secrets en `docs/CI-CD.md` (#12).
- Sección de control de versiones y releases en el README (#12).

## [1.0.2] - 2026-10-15

### Documentación
- Registro de la simulación del flujo GitFlow y guía de trazabilidad en `docs/TRAZABILIDAD.md` (#9).

## [1.0.1] - 2026-10-15

### Corregido
- `DELETE /api/productos/:id` con un id inexistente respondía `204` y eliminaba el último producto del catálogo (`splice(-1, 1)`). Ahora responde `404` sin modificar los datos.

## [1.0.0] - 2026-10-15

### Agregado
- Endpoints `PUT`, `PATCH` y `DELETE` para completar el CRUD de productos (#2).
- Filtros por categoría, texto y rango de precio, y ordenamiento en `GET /api/productos` (#3).
- Pipeline CI/CD en GitHub Actions: validación de commits, lint, tests en Node 22/24, build de imagen Docker con smoke tests, deploy a staging simulado y publicación en GHCR (#1).
- Dockerfile multi-etapa y `docker-compose.yml` como entorno cloud simulado (#1).
- Guía de buenas prácticas, documentación del pipeline, plantilla de PR y CODEOWNERS (#4).

## [0.1.0] - 2026-10-15

### Agregado
- Versión inicial del microservicio: `GET /health`, `GET /api/productos`, `GET /api/productos/:id` y `POST /api/productos`.

[1.2.1]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/616772e...v1.0.0
[0.1.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/commit/616772e
