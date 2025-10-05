const express = require('express');
const lstController = require('../controllers/lstController');

const router = express.Router();

// GET routes
router.get('/', lstController.getAllLSTData);
router.get('/location/:lat/:lon', lstController.getLSTDataByLocation);
router.get('/search', lstController.searchLSTData);
router.get('/statistics', lstController.getAllLSTStatistics);
router.get('/statistics/band/:band', lstController.getStatisticsByBand);
router.get('/data-with-statistics', lstController.getLSTDataWithStatistics);

// POST routes
router.post('/', lstController.createLSTData);
router.post('/filter-by-date', lstController.filterLSTByDateRange);
router.post('/temperature-stats', lstController.getTemperatureStats);
router.post('/statistics', lstController.createLSTStatistics);
router.post('/statistics/date-range', lstController.getStatisticsByDateRange);

// PUT routes
router.put('/:id', lstController.updateLSTData);

// DELETE routes
router.delete('/:id', lstController.deleteLSTData);

module.exports = router;