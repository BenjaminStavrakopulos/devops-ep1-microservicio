const { Router } = require('express');
const repo = require('../data/productosRepository');
const { validarProducto, filtrarCampos } = require('../validators/producto');

const router = Router();

function parsearId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', (req, res) => {
  res.json(repo.listar());
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

module.exports = router;
