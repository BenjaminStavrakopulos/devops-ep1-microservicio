# productos-service

Microservicio REST para la gestión de un catálogo de productos, construido con Node.js y Express.

## Requisitos

- Node.js 22 o superior

## Ejecución local

```bash
npm install
npm start          # http://localhost:3000
npm test           # ejecuta las pruebas
```

## Endpoints

| Método | Ruta                  | Descripción                 |
|--------|-----------------------|-----------------------------|
| GET    | `/health`             | Estado del servicio         |
| GET    | `/api/productos`      | Lista todos los productos   |
| GET    | `/api/productos/:id`  | Obtiene un producto por id  |
| POST   | `/api/productos`      | Crea un producto            |
| PUT    | `/api/productos/:id`  | Reemplaza un producto       |
| PATCH  | `/api/productos/:id`  | Actualiza campos de un producto |
| DELETE | `/api/productos/:id`  | Elimina un producto         |

### Filtros del listado

`GET /api/productos` acepta los siguientes parámetros opcionales (combinables):

| Parámetro   | Ejemplo            | Descripción                                   |
|-------------|--------------------|-----------------------------------------------|
| `categoria` | `?categoria=audio` | Filtra por categoría (sin distinguir mayúsculas) |
| `q`         | `?q=teclado`       | Busca el texto dentro del nombre              |
| `precioMin` | `?precioMin=10000` | Precio mínimo                                 |
| `precioMax` | `?precioMax=50000` | Precio máximo                                 |
| `ordenar`   | `?ordenar=-precio` | Ordena por `nombre`, `precio` o `stock` (prefijo `-` = descendente) |
