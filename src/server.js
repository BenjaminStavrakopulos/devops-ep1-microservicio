const { crearApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;

crearApp().listen(PORT, () => {
  console.log(`productos-service escuchando en el puerto ${PORT}`);
});
