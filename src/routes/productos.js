const { Router } = require('express');
const repo = require('../data/productosRepository');
const { validarProducto, filtrarCampos } = require('../validators/producto');
const { parsearFiltros, aplicarFiltros } = require('../filtros/productos');

const router = Router();

function parsearId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', (req, res) => {
  const { filtros, errores } = parsearFiltros(req.query);
  if (errores.length > 0) return res.status(400).json({ errores });

  res.json(aplicarFiltros(repo.listar(), filtros));
});

router.get('/:id', (req, res) => {
  const id = parsearId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

  const producto = repo.obtenerPorId(id);
  if (!producto) return res.status(404).json({ error: `Producto ${id} no encontrado` });

  res.json(producto);
});

router.post('/', (req, res) => {
  const errores = validarProducto(req.body);
  if (errores.length > 0) return res.status(400).json({ errores });

  const producto = repo.crear(filtrarCampos(req.body));
  res.status(201).location(`/api/productos/${producto.id}`).json(producto);
});

// PUT reemplaza el producto completo; PATCH actualiza solo los campos enviados
function actualizarProducto({ parcial }) {
  return (req, res) => {
    const id = parsearId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

    const errores = validarProducto(req.body, { parcial });
    if (errores.length > 0) return res.status(400).json({ errores });

    const producto = repo.actualizar(id, filtrarCampos(req.body));
    if (!producto) return res.status(404).json({ error: `Producto ${id} no encontrado` });

    res.json(producto);
  };
}

router.put('/:id', actualizarProducto({ parcial: false }));
router.patch('/:id', actualizarProducto({ parcial: true }));

router.delete('/:id', (req, res) => {
  const id = parsearId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

  const eliminado = repo.eliminar(id);
  if (!eliminado) return res.status(404).json({ error: `Producto ${id} no encontrado` });

  res.status(204).end();
});

module.exports = router;
