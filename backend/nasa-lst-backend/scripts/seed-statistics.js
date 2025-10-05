const lstService = require('../src/services/lstService');
const fs = require('fs');
const path = require('path');

// Sample statistics data based on your JSON format
const sampleStatisticsData = {
  "statistics": [
    {
      "modis_date": "A2000049", 
      "calendar_date": "2000-02-18", 
      "band": "LST_Day_1km", 
      "value_center": "308.68", 
      "value_min": 308.22, 
      "value_max": 313.22, 
      "value_sum": 25212.4785, 
      "value_range": 5.0, 
      "value_mean": 311.2652, 
      "value_variance": 1.4492, 
      "value_stddev": 1.2038, 
      "pixels_total": 81, 
      "pixels_pass": 81, 
      "pixels_pass_rel": 100.0, 
      "proc_date": "2020048120243"
    }, 
    {
      "modis_date": "A2000049", 
      "calendar_date": "2000-02-18", 
      "band": "LST_Night_1km", 
      "value_center": "282.78", 
      "value_min": 280.56, 
      "value_max": 284.54, 
      "value_sum": 22901.2988, 
      "value_range": 3.98, 
      "value_mean": 282.7321, 
      "value_variance": 0.9919, 
      "value_stddev": 0.9959, 
      "pixels_total": 81, 
      "pixels_pass": 81, 
      "pixels_pass_rel": 100.0, 
      "proc_date": "2020048120243"
    }
  ]
};

async function seedStatisticsData() {
  try {
    console.log('📊 Starting statistics data seeding...');
    
    // Load your Clear_sky_days.json file if it exists
    const jsonFilePath = path.join(__dirname, '..', '..', '..', 'Users', 'nmesrati', 'Downloads', 'Clear_sky_days.json');
    let statisticsData = sampleStatisticsData;
    
    if (fs.existsSync(jsonFilePath)) {
      console.log('📁 Loading statistics data from Clear_sky_days.json');
      const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
      statisticsData = JSON.parse(fileContent);
    } else {
      console.log('📁 Clear_sky_days.json not found, using sample data');
    }
    
    // Insert the statistics data
    const result = await lstService.insertLSTStatistics(statisticsData);
    console.log('✅ Statistics data inserted successfully:', result);
    
    // Test getting statistics
    console.log('🔍 Testing statistics retrieval...');
    const allStats = await lstService.getAllLSTStatistics();
    console.log('📊 Retrieved statistics count:', allStats.length);
    
    // Test joined data
    console.log('🔗 Testing joined data retrieval...');
    const joinedData = await lstService.getLSTDataWithStatistics();
    console.log('📊 Joined data count:', joinedData.length);
    
    console.log('🎉 Statistics database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding statistics database:', error.message);
    process.exit(1);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedStatisticsData();
}

module.exports = seedStatisticsData;
