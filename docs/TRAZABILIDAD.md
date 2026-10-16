# Simulación del flujo colaborativo y trazabilidad

Este documento registra paso a paso cómo se construyó el repositorio con **GitFlow**: los comandos Git usados en cada etapa, los pull requests, los tags y las ejecuciones del pipeline. Con eso, cualquier cambio se puede rastrear desde la línea de código hasta su despliegue.

> Repositorio: <https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio>
> Trabajo individual: el mismo autor creó, revisó y mergeó cada PR (ver nota en la [guía](GUIA-BUENAS-PRACTICAS.md#5-estrategia-de-revisión-de-código)).

## Resumen

| PR | Tipo | Rama origen → destino | Merge commit | Resultado CI |
|----|------|-----------------------|--------------|--------------|
| [#1](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/1) | feature | `feature/pipeline-ci` → `develop` | `5f040cb` | ✅ |
| [#2](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/2) | feature | `feature/crud-productos` → `develop` | `64689d7` | ✅ |
| [#3](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/3) | feature | `feature/filtros-busqueda` → `develop` | `36c5b08` | ✅ |
| [#4](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/4) | feature | `feature/documentacion-repositorio` → `develop` | `650c387` | ✅ |
| [#5](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/5) | release | `release/1.0.0` → `main` | `f7eeea1` → tag **v1.0.0** | ✅ |
| [#6](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/6) | release (back-merge) | `release/1.0.0` → `develop` | `4be1f08` | ✅ |
| [#7](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/7) | hotfix | `hotfix/eliminar-producto-inexistente` → `main` | `0be83e0` → tag **v1.0.1** | ✅ |
| [#8](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/8) | hotfix (back-merge) | `hotfix/eliminar-producto-inexistente` → `develop` | `ff3768a` | ✅ |
| [#9](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/9) | feature (docs) | `feature/documentar-trazabilidad` → `develop` | — | ✅ |
| [#10](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/10) | release | `release/1.0.2` → `main` | tag **v1.0.2** | ✅ |
| [#11](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/pull/11) | release (back-merge) | `release/1.0.2` → `develop` | — | ✅ |

**Tags y releases:** [v1.0.0](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.0) · [v1.0.1](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.1) · [v1.0.2](https://github.com/BenjaminStavrakopulos/devops-ep1-microservicio/releases/tag/v1.0.2)

**Imagen publicada:** `ghcr.io/benjaminstavrakopulos/productos-service` (etiquetas `1.0.0`, `1.0.1`, `latest`, `sha-*`)

---

## Etapa 0: Creación del repositorio

Se parte del microservicio base (v0.1.0): health check, listado, consulta y creación de productos, con sus pruebas.

```bash
git init -b main
git add .
git commit -m "chore: versión inicial del microservicio productos-service"
gh repo create devops-ep1-microservicio --public --source . --push   # crea el remoto y hace push de main
git switch -c develop                                                 # rama de integración
git push -u origin develop
```

Commit: `616772e`

## Etapa 1: Feature `feature/pipeline-ci` (PR #1)

Agrega ESLint, Docker, pruebas de humo y el workflow de GitHub Actions.

```bash
git switch -c feature/pipeline-ci            # nace de develop
npm install -D eslint @eslint/js globals
git add .gitattributes && git add --renormalize .
git commit -m "chore: normalizar finales de línea con .gitattributes"
git add package.json package-lock.json eslint.config.js .nvmrc
git commit -m "build: agregar ESLint y script de cobertura de pruebas"
git add Dockerfile .dockerignore docker-compose.yml scripts/
git commit -m "build: contenerizar el servicio con Docker y agregar pruebas de humo"
git add .github
git commit -m "ci: agregar pipeline de GitHub Actions para develop y main"
git push -u origin feature/pipeline-ci
gh pr create --base develop --head feature/pipeline-ci --title "ci: pipeline de integración y despliegue continuo"
gh pr checks 1 --watch                        # esperar a que el CI esté en verde
gh pr merge 1 --merge                         # merge commit hacia develop
```

| Commit | Mensaje |
|--------|---------|
| `0324181` | chore: normalizar finales de línea con .gitattributes |
| `96d02e0` | build: agregar ESLint y script de cobertura de pruebas |
| `4f3c889` | build: contenerizar el servicio con Docker y agregar pruebas de humo |
| `a49ad9d` | ci: agregar pipeline de GitHub Actions para develop y main |

**Evidencia CI:** en el PR corrieron validación de commits, lint/tests (Node 22 y 24) y build + smoke test. Al mergear, el push a `develop` disparó por primera vez el job **Deploy a staging**, que terminó exitoso.

## Etapa 2: Feature `feature/crud-productos` (PR #2)

```bash
git switch develop && git pull                # traer el merge del PR #1
git switch -c feature/crud-productos
git commit -m "feat(productos): agregar operaciones de actualización y eliminación al repositorio"
git commit -m "feat(productos): exponer endpoints PUT, PATCH y DELETE"
git commit -m "test(productos): cubrir actualización y eliminación de productos"
git commit -m "docs(readme): documentar nuevos endpoints de productos"
git push -u origin feature/crud-productos
gh pr create --base develop ...
gh pr merge 2 --merge
```

| Commit | Mensaje |
|--------|---------|
| `739401d` | feat(productos): agregar operaciones de actualización y eliminación al repositorio |
| `a62efa5` | feat(productos): exponer endpoints PUT, PATCH y DELETE |
| `e549fbb` | test(productos): cubrir actualización y eliminación de productos |
| `9ee832f` | docs(readme): documentar nuevos endpoints de productos |

> Esta feature introdujo, sin que nadie lo notara, el bug que después se corrigió en el hotfix (etapa 6): las pruebas solo cubrían eliminar un producto existente.

## Etapa 3: Feature `feature/filtros-busqueda` (PR #3)

```bash
git switch develop && git pull
git switch -c feature/filtros-busqueda
git commit -m "feat(productos): filtrar listado por categoría, texto y rango de precio"
git commit -m "test(productos): agregar pruebas de filtros y ordenamiento"
git commit -m "docs(readme): documentar parámetros de filtrado del listado"
git push -u origin feature/filtros-busqueda
gh pr create --base develop ...
gh pr merge 3 --merge
```

| Commit | Mensaje |
|--------|---------|
| `616b58d` | feat(productos): filtrar listado por categoría, texto y rango de precio |
| `d8d49f2` | test(productos): agregar pruebas de filtros y ordenamiento |
| `7a3c081` | docs(readme): documentar parámetros de filtrado del listado |

## Etapa 4: Feature `feature/documentacion-repositorio` (PR #4)

```bash
git switch develop && git pull
git switch -c feature/documentacion-repositorio
git commit -m "docs: agregar guía de buenas prácticas del repositorio"
git commit -m "docs(ci): explicar etapas y rol del pipeline CI/CD"
git commit -m "chore: agregar plantilla de PR, CODEOWNERS y guía de contribución"
git commit -m "docs(readme): documentar estrategia de ramificación, pipeline y convenciones"
git push -u origin feature/documentacion-repositorio
gh pr create --base develop ...
gh pr merge 4 --merge
```

## Etapa 5: Release `release/1.0.0` (PR #5 y #6)

```bash
git switch develop && git pull
git switch -c release/1.0.0
npm version 1.0.0 --no-git-tag-version
git commit -m "chore(release): actualizar versión a 1.0.0"
git commit -m "docs(changelog): registrar cambios de la versión 1.0.0"
git push -u origin release/1.0.0
gh pr create --base main --head release/1.0.0 ...      # PR #5
gh pr merge 5 --merge

git switch main && git pull
git tag -a v1.0.0 -m "Versión 1.0.0"                     # tag anotado
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes "..."

gh pr create --base develop --head release/1.0.0 ...   # PR #6: back-merge
gh pr merge 6 --merge
```

**Evidencia CI:** el push a `main` ejecutó el job **Publicar imagen en GHCR (production)**, que publicó la imagen `productos-service:1.0.0`.

## Etapa 6: Hotfix `hotfix/eliminar-producto-inexistente` (PR #7 y #8)

**Problema detectado en producción (v1.0.0):**

```
DELETE /api/productos/999  -> 204 No Content
GET /api/productos         -> ids [1, 2]   # el producto 3 fue eliminado
```

`findIndex` devolvía `-1` y `splice(-1, 1)` eliminaba el último producto.

```bash
git switch main && git pull
git switch -c hotfix/eliminar-producto-inexistente      # nace de main, no de develop
git commit -m "test(productos): reproducir eliminación de un producto inexistente"   # el test falla
git commit -m "fix(productos): responder 404 al eliminar un id inexistente"           # el test pasa
git commit -m "test(smoke): verificar DELETE de un producto inexistente"
npm version 1.0.1 --no-git-tag-version
git commit -m "chore(release): actualizar versión a 1.0.1"
git push -u origin hotfix/eliminar-producto-inexistente
gh pr create --base main ...                              # PR #7
gh pr merge 7 --merge

git switch main && git pull
git tag -a v1.0.1 -m "Versión 1.0.1 (hotfix)"
git push origin v1.0.1
gh release create v1.0.1 ...

gh pr create --base develop --head hotfix/eliminar-producto-inexistente ...   # PR #8: back-merge
gh pr merge 8 --merge
```

| Commit | Mensaje |
|--------|---------|
| `29d70c2` | test(productos): reproducir eliminación de un producto inexistente |
| `2764a76` | fix(productos): responder 404 al eliminar un id inexistente |
| `f0115f6` | test(smoke): verificar DELETE de un producto inexistente |
| `12854d9` | chore(release): actualizar versión a 1.0.1 |

El hotfix llegó a producción **sin arrastrar trabajo pendiente de `develop`**, y gracias al back-merge (#8) la corrección no se pierde en la próxima release.

## Etapa 7: Documentación de trazabilidad y release 1.0.2 (PR #9, #10 y #11)

Este mismo documento se integró siguiendo el flujo: `feature/documentar-trazabilidad` → `develop` (#9), luego `release/1.0.2` → `main` (#10, tag `v1.0.2`) y el back-merge `release/1.0.2` → `develop` (#11). Como solo cambia documentación, se publicó como versión PATCH.

## Historial resultante

Salida de `git log --oneline --graph --all` (se ven los merges de cada PR hacia `develop` y `main`):

```text
*   ff3768a Merge pull request #8 from hotfix/eliminar-producto-inexistente into develop
|\
* \   4be1f08 Merge pull request #6 from release/1.0.0 into develop
|\ \
| | | *   0be83e0 Merge pull request #7 from hotfix/eliminar-producto-inexistente   (tag v1.0.1)
| | | |\
| | | |/
| | |/|
| | * | 12854d9 chore(release): actualizar versión a 1.0.1
| | * | f0115f6 test(smoke): verificar DELETE de un producto inexistente
| | * | 2764a76 fix(productos): responder 404 al eliminar un id inexistente
| | * | 29d70c2 test(productos): reproducir eliminación de un producto inexistente
| | |/
| | *   f7eeea1 Merge pull request #5 from release/1.0.0                           (tag v1.0.0)
| | |\
| | |/
| |/|
| * | 0279798 docs(changelog): registrar cambios de la versión 1.0.0
| * | 19077d5 chore(release): actualizar versión a 1.0.0
|/ /
* |   650c387 Merge pull request #4 from feature/documentacion-repositorio
|\ \
| * | d71c2da docs(readme): documentar estrategia de ramificación, pipeline y convenciones
| * | 58ee268 chore: agregar plantilla de PR, CODEOWNERS y guía de contribución
| * | 5f2c747 docs(ci): explicar etapas y rol del pipeline CI/CD
| * | f026d6a docs: agregar guía de buenas prácticas del repositorio
|/ /
* |   36c5b08 Merge pull request #3 from feature/filtros-busqueda
|\ \
| * | 7a3c081 docs(readme): documentar parámetros de filtrado del listado
| * | d8d49f2 test(productos): agregar pruebas de filtros y ordenamiento
| * | 616b58d feat(productos): filtrar listado por categoría, texto y rango de precio
|/ /
* |   64689d7 Merge pull request #2 from feature/crud-productos
|\ \
| * | 9ee832f docs(readme): documentar nuevos endpoints de productos
| * | e549fbb test(productos): cubrir actualización y eliminación de productos
| * | a62efa5 feat(productos): exponer endpoints PUT, PATCH y DELETE
| * | 739401d feat(productos): agregar operaciones de actualización y eliminación al repositorio
|/ /
* |   5f040cb Merge pull request #1 from feature/pipeline-ci
|\ \
| |/
|/|
| * a49ad9d ci: agregar pipeline de GitHub Actions para develop y main
| * 4f3c889 build: contenerizar el servicio con Docker y agregar pruebas de humo
| * 96d02e0 build: agregar ESLint y script de cobertura de pruebas
| * 0324181 chore: normalizar finales de línea con .gitattributes
|/
* 616772e chore: versión inicial del microservicio productos-service
```

## Cómo rastrear un cambio

Ejemplo: ¿por qué existe la validación `indice === -1` en `productosRepository.js`?

```bash
git blame -L 39,40 src/data/productosRepository.js   # -> commit 2764a76
git show 2764a76                                     # mensaje: explica la causa del bug
git log --merges --ancestry-path 2764a76..main --oneline | tail -1   # -> Merge pull request #7
gh pr view 7                                         # descripción, reproducción y checks del CI
git tag --contains 2764a76                           # -> v1.0.1 (versión en que llegó a producción)
```

Otros comandos útiles:

| Pregunta | Comando |
|----------|---------|
| ¿Qué cambió entre dos versiones? | `git log v1.0.0..v1.0.1 --oneline` |
| ¿Qué commits son correcciones? | `git log --oneline --grep "^fix"` |
| ¿Qué versión está desplegada? | `curl <host>/health` → campo `version` |
| ¿Qué código corre en una imagen? | La etiqueta `sha-xxxxxxx` de la imagen en GHCR corresponde al commit |
| ¿Qué ejecuciones del pipeline hubo? | `gh run list` / pestaña *Actions* |
