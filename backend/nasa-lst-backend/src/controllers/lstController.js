const lstService = require('../services/lstService');

class LSTController {
  // GET /api/lst
  async getAllLSTData(req, res) {
    try {
      const data = await lstService.getAllLSTData();
      res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/lst/location/:lat/:lon
  async getLSTDataByLocation(req, res) {
    try {
      const { lat, lon } = req.params;
      const { radius } = req.query;
      
      const data = await lstService.getLSTDataByLocation(
        parseFloat(lat), 
        parseFloat(lon), 
        radius ? parseFloat(radius) : 0.1
      );
      
      res.json({
        success: true,
        data,
        location: { latitude: lat, longitude: lon },
        radius: radius || 0.1
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/lst/filter-by-date
  async filterLSTByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const data = await lstService.filterLSTByDateRange(startDate, endDate);
      
      res.json({
        success: true,
        data,
        filters: { startDate, endDate }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/lst/temperature-stats
  async getTemperatureStats(req, res) {
    try {
      const { latMin, latMax, lonMin, lonMax } = req.body;
      
      if (!latMin || !latMax || !lonMin || !lonMax) {
        return res.status(400).json({
          success: false,
          error: 'latMin, latMax, lonMin, lonMax are required'
        });
      }

      const data = await lstService.getTemperatureStats(latMin, latMax, lonMin, lonMax);
      
      res.json({
        success: true,
        data,
        region: { latMin, latMax, lonMin, lonMax }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/lst
  async createLSTData(req, res) {
    try {
      const lstData = req.body;
      
      // Validate required fields
      const requiredFields = ['xllcorner', 'yllcorner', 'cellsize', 'nrows', 'ncols', 'band', 'units', 'scale', 'latitude', 'longitude', 'subset'];
      const missingFields = requiredFields.filter(field => !lstData[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const data = await lstService.insertLSTData(lstData);
      
      res.status(201).json({
        success: true,
        data,
        message: 'LST data created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // PUT /api/lst/:id
  async updateLSTData(req, res) {
    try {
      const { id } = req.params;
      const lstData = req.body;
      
      const data = await lstService.updateLSTData(id, lstData);
      
      res.json({
        success: true,
        data,
        message: 'LST data updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // DELETE /api/lst/:id
  async deleteLSTData(req, res) {
    try {
      const { id } = req.params;
      
      const result = await lstService.deleteLSTData(id);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/lst/search
  async searchLSTData(req, res) {
    try {
      const filters = req.query;
      
      const data = await lstService.searchLSTData(filters);
      
      res.json({
        success: true,
        data,
        filters,
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/lst/statistics
  async createLSTStatistics(req, res) {
    try {
      const statisticsData = req.body;
      
      if (!statisticsData.statistics || !Array.isArray(statisticsData.statistics)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid statistics data format. Expected { statistics: [...] }'
        });
      }

      const result = await lstService.insertLSTStatistics(statisticsData);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'LST statistics created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/lst/statistics
  async getAllLSTStatistics(req, res) {
    try {
      const data = await lstService.getAllLSTStatistics();
      
      res.json({
        success: true,
        data,
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/lst/data-with-statistics
  async getLSTDataWithStatistics(req, res) {
    try {
      const { latitude, longitude, band } = req.query;
      
      const data = await lstService.getLSTDataWithStatistics(
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        band
      );
      
      res.json({
        success: true,
        data,
        filters: { latitude, longitude, band },
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/lst/statistics/band/:band
  async getStatisticsByBand(req, res) {
    try {
      const { band } = req.params;
      
      const data = await lstService.getStatisticsByBand(band);
      
      res.json({
        success: true,
        data,
        band,
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/lst/statistics/date-range
  async getStatisticsByDateRange(req, res) {
    try {
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const data = await lstService.getStatisticsByDateRange(startDate, endDate);
      
      res.json({
        success: true,
        data,
        filters: { startDate, endDate },
        count: data.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new LSTController();