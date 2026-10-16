# Política de seguridad

## Versiones soportadas

Solo la última versión publicada en `main` (ver [Releases](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases)) recibe correcciones de seguridad, que se publican como `hotfix/*` (versión PATCH).

## Reportar una vulnerabilidad

No abras un issue público. Usa **Security → Report a vulnerability** en este repositorio (reporte privado).

## Controles automáticos

| Control | Herramienta | Respuesta ante un hallazgo |
|---------|-------------|----------------------------|
| Dependencias vulnerables | Dependabot alerts + security updates | Alerta en *Security* y PR automático con la corrección |
| Dependencias desactualizadas | Dependabot version updates (semanal) | PR hacia `develop` |
| Vulnerabilidades en dependencias npm | `npm audit --audit-level=high` | **Bloquea** el pipeline |
| Dependencias nuevas en un PR | Dependency Review | **Bloquea** el PR (severidad *high* o superior) |
| Vulnerabilidades de la imagen | Trivy | **Bloquea** el despliegue (HIGH/CRITICAL con parche) y publica alertas en *Security → Code scanning* |
| Calidad y seguridad del código | SonarCloud (Quality Gate) | **Bloquea** el pipeline |
| Credenciales en el código | gitleaks + GitHub secret scanning + push protection | **Bloquea** el pipeline / rechaza el push |
| Cualquier control en `develop`/`main` | Job `Alerta de seguridad` | Abre un issue con la etiqueta `seguridad` |
