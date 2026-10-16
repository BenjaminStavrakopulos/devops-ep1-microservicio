# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [Versionado Semántico](https://semver.org/lang/es/).

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

[1.1.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/compare/616772e...v1.0.0
[0.1.0]: https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/commit/616772e
