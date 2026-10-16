const { Router } = require('express');
const repo = require('../data');
const { validarProducto, filtrarCampos } = require('../validators/producto');
const { parsearFiltros, aplicarFiltros } = require('../filtros/productos');

const router = Router();

function parsearId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', async (req, res) => {
  const { filtros, errores } = parsearFiltros(req.query);
  if (errores.length > 0) return res.status(400).json({ errores });

  res.json(aplicarFiltros(await repo.listar(), filtros));
});

router.get('/:id', async (req, res) => {
  const id = parsearId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

  const producto = await repo.obtenerPorId(id);
  if (!producto) return res.status(404).json({ error: `Producto ${id} no encontrado` });

  res.json(producto);
});

router.post('/', async (req, res) => {
  const errores = validarProducto(req.body);
  if (errores.length > 0) return res.status(400).json({ errores });

  const producto = await repo.crear(filtrarCampos(req.body));
  res.status(201).location(`/api/productos/${producto.id}`).json(producto);
});

// PUT reemplaza el producto completo; PATCH actualiza solo los campos enviados
function actualizarProducto({ parcial }) {
  return async (req, res) => {
    const id = parsearId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

    const errores = validarProducto(req.body, { parcial });
    if (errores.length > 0) return res.status(400).json({ errores });

    const producto = await repo.actualizar(id, filtrarCampos(req.body));
    if (!producto) return res.status(404).json({ error: `Producto ${id} no encontrado` });

    res.json(producto);
  };
}

router.put('/:id', actualizarProducto({ parcial: false }));
router.patch('/:id', actualizarProducto({ parcial: true }));

router.delete('/:id', async (req, res) => {
  const id = parsearId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'El id debe ser un entero positivo' });

  const eliminado = await repo.eliminar(id);
  if (!eliminado) return res.status(404).json({ error: `Producto ${id} no encontrado` });

  res.status(204).end();
});

module.exports = router;
