// index.js
const express = require('express');
const cors = require('cors');
const vuelosRoutes = require('./routes/vuelosRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // ¡Vital para que el mapa pueda leer los datos!
app.use(express.json());

// Rutas
app.use('/api', vuelosRoutes);

// Mensaje de bienvenida
app.get('/', (req, res) => {
    res.send('📡 Radar API v2.0 - Funcionando ✈️');
});

// Arrancar
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend corriendo en: http://localhost:${PORT}`);
    console.log(`📡 Endpoint de datos: http://localhost:${PORT}/api/vuelos-live`);
});