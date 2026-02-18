// routes/vuelosRoutes.js
const express = require('express');
const router = express.Router();
const vuelosController = require('../controllers/vuelosController');

// Definimos el endpoint: http://localhost:3000/api/vuelos-live
router.get('/vuelos-live', vuelosController.getVuelosEnVivo);

module.exports = router;