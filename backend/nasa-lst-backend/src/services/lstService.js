const axios = require('axios');

class LSTService {
  constructor() {
    this.postgrestUrl = process.env.POSTGREST_URL || 'http://localhost:3001';
  }

  // Get all LST data
  async getAllLSTData() {
    try {
      const response = await axios.get(`${this.postgrestUrl}/lst_tr_sf_data`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch LST data: ${error.message}`);
    }
  }

  // Get LST data by location
  async getLSTDataByLocation(latitude, longitude, radius = 0.1) {
    try {
      const response = await axios.get(`${this.postgrestUrl}/lst_tr_sf_data`, {
        params: {
          latitude: `gte.${latitude - radius}`,
          latitude: `lte.${latitude + radius}`,
          longitude: `gte.${longitude - radius}`,
          longitude: `lte.${longitude + radius}`
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch LST data by location: ${error.message}`);
    }
  }

  // Filter LST data by date range using PostgreSQL function
  async filterLSTByDateRange(startDate, endDate) {
    try {
      const response = await axios.post(`${this.postgrestUrl}/rpc/filter_lst_by_date`, {
        start_date: startDate,
        end_date: endDate
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to filter LST data by date: ${error.message}`);
    }
  }

  // Get temperature statistics for a region
  async getTemperatureStats(latMin, latMax, lonMin, lonMax) {
    try {
      const response = await axios.post(`${this.postgrestUrl}/rpc/get_temperature_stats`, {
        lat_min: latMin,
        lat_max: latMax,
        lon_min: lonMin,
        lon_max: lonMax
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get temperature statistics: ${error.message}`);
    }
  }

  // Insert new LST data
  async insertLSTData(lstData) {
    try {
      const response = await axios.post(`${this.postgrestUrl}/lst_tr_sf_data`, {
        xllcorner: lstData.xllcorner,
        yllcorner: lstData.yllcorner,
        cellsize: lstData.cellsize,
        nrows: lstData.nrows,
        ncols: lstData.ncols,
        band: lstData.band,
        units: lstData.units,
        scale: lstData.scale,
        latitude: lstData.latitude,
        longitude: lstData.longitude,
        header: lstData.header,
        subset: lstData.subset
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to insert LST data: ${error.message}`);
    }
  }

  // Update LST data
  async updateLSTData(id, lstData) {
    try {
      const response = await axios.patch(`${this.postgrestUrl}/lst_tr_sf_data?id=eq.${id}`, {
        ...lstData,
        updated_at: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update LST data: ${error.message}`);
    }
  }

  // Delete LST data
  async deleteLSTData(id) {
    try {
      const response = await axios.delete(`${this.postgrestUrl}/lst_tr_sf_data?id=eq.${id}`);
      return { success: true, message: 'LST data deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete LST data: ${error.message}`);
    }
  }

  // Search LST data with complex queries
  async searchLSTData(filters) {
    try {
      const params = {};
      
      if (filters.band) {
        params.band = `eq.${filters.band}`;
      }
      
      if (filters.dateFrom && filters.dateTo) {
        // Use JSON operators to filter subset data
        params['subset'] = `cs.${JSON.stringify([{calendar_date: {gte: filters.dateFrom, lte: filters.dateTo}}])}`;
      }
      
      if (filters.minLat && filters.maxLat) {
        params.latitude = `gte.${filters.minLat}`;
        params.latitude = `lte.${filters.maxLat}`;
      }
      
      if (filters.minLon && filters.maxLon) {
        params.longitude = `gte.${filters.minLon}`;
        params.longitude = `lte.${filters.maxLon}`;
      }

      const response = await axios.get(`${this.postgrestUrl}/lst_tr_sf_data`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search LST data: ${error.message}`);
    }
  }

  // Insert LST Statistics data
  async insertLSTStatistics(statisticsData) {
    try {
      const response = await axios.post(`${this.postgrestUrl}/rpc/insert_lst_statistics`, {
        statistics_json: statisticsData
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to insert LST statistics: ${error.message}`);
    }
  }

  // Get all LST Statistics
  async getAllLSTStatistics() {
    try {
      const response = await axios.get(`${this.postgrestUrl}/lst_statistics`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch LST statistics: ${error.message}`);
    }
  }

  // Get LST data with joined statistics
  async getLSTDataWithStatistics(latitude = null, longitude = null, band = null) {
    try {
      const payload = {};
      if (latitude) payload.target_latitude = latitude;
      if (longitude) payload.target_longitude = longitude;
      if (band) payload.band_filter = band;

      const response = await axios.post(`${this.postgrestUrl}/rpc/get_lst_data_with_statistics`, payload);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch LST data with statistics: ${error.message}`);
    }
  }

  // Get statistics by band
  async getStatisticsByBand(band) {
    try {
      const response = await axios.get(`${this.postgrestUrl}/lst_statistics`, {
        params: { band: `eq.${band}` }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch statistics by band: ${error.message}`);
    }
  }

  // Get statistics by date range
  async getStatisticsByDateRange(startDate, endDate) {
    try {
      const response = await axios.get(`${this.postgrestUrl}/lst_statistics`, {
        params: {
          calendar_date: `gte.${startDate}`,
          calendar_date: `lte.${endDate}`
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch statistics by date range: ${error.message}`);
    }
  }
}

module.exports = new LSTService();