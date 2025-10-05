const lstService = require('../src/services/lstService');
const fs = require('fs');
const path = require('path');

// Sample LST data based on your JSON format
const sampleLSTData = {
  "xllcorner": "562461.62", 
  "yllcorner": "2529687.43", 
  "cellsize": 926.6254330558338, 
  "nrows": 9, 
  "ncols": 9, 
  "band": "LST_Day_1km", 
  "units": "Kelvin", 
  "scale": "0.02", 
  "latitude": 22.79, 
  "longitude": 5.53, 
  "header": "https://modisrest.ornl.gov/rst/api/v1/MOD11A2/dz_tamanrasset_inm/subset?band=LST_Day_1km&startDate=A1980001&endDate=A2025001", 
  "subset": [
    {
      "modis_date": "A2000049", 
      "calendar_date": "2000-02-18", 
      "band": "LST_Day_1km", 
      "tile": "h18v06", 
      "proc_date": "2020048120243", 
      "data": [15571.0, 15559.0, 15563.0, 15572.0, 15611.0, 15636.0, 15621.0, 15587.0, 15587.0, 15583.0, 15567.0, 15493.0, 15475.0, 15539.0, 15608.0, 15607.0, 15589.0, 15585.0, 15537.0, 15508.0, 15438.0, 15448.0, 15501.0, 15542.0, 15599.0, 15598.0, 15606.0, 15532.0, 15471.0, 15417.0, 15413.0, 15411.0, 15459.0, 15578.0, 15589.0, 15615.0, 15568.0, 15527.0, 15491.0, 15460.0, 15434.0, 15475.0, 15563.0, 15572.0, 15604.0, 15593.0, 15560.0, 15536.0, 15498.0, 15471.0, 15519.0, 15559.0, 15579.0, 15608.0, 15609.0, 15595.0, 15595.0, 15604.0, 15597.0, 15581.0, 15578.0, 15594.0, 15611.0, 15624.0, 15583.0, 15587.0, 15627.0, 15620.0, 15610.0, 15596.0, 15611.0, 15618.0, 15572.0, 15564.0, 15578.0, 15627.0, 15640.0, 15661.0, 15661.0, 15627.0, 15622.0], 
      "filename": ""
    }
  ]
};

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Load your JSON file if it exists
    const jsonFilePath = path.join(__dirname, '..', '..', 'LST_Day_1km.json');
    let lstData = sampleLSTData;
    
    if (fs.existsSync(jsonFilePath)) {
      console.log('📁 Loading data from LST_Day_1km.json');
      const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
      lstData = JSON.parse(fileContent);
    }
    
    // Insert the data
    const result = await lstService.insertLSTData(lstData);
    console.log('✅ Data inserted successfully:', result);
    
    // Test the filtering function
    console.log('🔍 Testing date filtering...');
    const filteredData = await lstService.filterLSTByDateRange('2000-01-01', '2000-12-31');
    console.log('📊 Filtered data:', filteredData);
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;