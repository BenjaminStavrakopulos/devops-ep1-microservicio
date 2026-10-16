# Cómo contribuir

1. Lee la [guía de buenas prácticas](docs/GUIA-BUENAS-PRACTICAS.md): ahí están el naming de ramas, la convención de commits, los flujos de merge y la estrategia de revisión.
2. Crea tu rama desde `develop`: `git switch develop && git pull && git switch -c feature/mi-cambio`.
3. Haz commits atómicos con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
4. Verifica localmente: `npm run lint && npm test`.
5. Sube la rama y abre un pull request hacia `develop` completando la plantilla.
6. Espera a que el pipeline esté en verde y a la revisión antes de mergear.

Para correcciones urgentes en producción, usa una rama `hotfix/*` desde `main` (ver sección 1 de la guía).
