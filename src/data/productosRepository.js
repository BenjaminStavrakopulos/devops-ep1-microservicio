// Repositorio en memoria. En un entorno productivo se reemplazaría por una base de datos.
const PRODUCTOS_INICIALES = [
  { id: 1, nombre: 'Teclado mecánico', categoria: 'perifericos', precio: 45990, stock: 12 },
  { id: 2, nombre: 'Mouse inalámbrico', categoria: 'perifericos', precio: 19990, stock: 30 },
  { id: 3, nombre: 'Monitor 27"', categoria: 'monitores', precio: 189990, stock: 5 },
];

let productos = [];
let siguienteId = 1;

function reiniciar() {
  productos = PRODUCTOS_INICIALES.map((p) => ({ ...p }));
  siguienteId = productos.length + 1;
}

function listar() {
  return productos;
}

function obtenerPorId(id) {
  return productos.find((p) => p.id === id);
}

function crear(datos) {
  const producto = { id: siguienteId++, categoria: 'general', ...datos };
  productos.push(producto);
  return producto;
}

function actualizar(id, datos) {
  const producto = obtenerPorId(id);
  if (!producto) return undefined;
  Object.assign(producto, datos);
  return producto;
}

function eliminar(id) {
  const indice = productos.findIndex((p) => p.id === id);
  // splice(-1, 1) eliminaría el último elemento, por eso se valida que exista
  if (indice === -1) return undefined;
  const [eliminado] = productos.splice(indice, 1);
  return eliminado;
}

reiniciar();

module.exports = { reiniciar, listar, obtenerPorId, crear, actualizar, eliminar };
