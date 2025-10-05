import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, switchMap, timeout, retry } from 'rxjs';

export interface ClimateData {
  lst_id: number;
  lat: number;
  lon: number;
  lst_band: string;
  lst_units: string;
  modis_date: string;
  calendar_date: string;
  value_center: string;
  value_min: number;
  value_max: number;
  value_mean: number;
  value_stddev: number;
  pixels_total: number;
  pixels_pass: number;
}

export interface VegetationData {
  vgt_id: number;
  lat: number;
  lon: number;
  vgt_band: string;
  vgt_units: string;
  modis_date: string;
  calendar_date: string;
  value_center: string;
  value_min: number;
  value_max: number;
  value_mean: number;
  value_stddev: number;
  pixels_total: number;
  pixels_pass: number;
}

export interface NDVIStatus {
  value: number;
  status: 'KO' | 'OK' | 'unknown';
  color: 'red' | 'green' | 'gray';
  description: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  dayTemp: number;
  nightTemp: number;
  locationName: string;
  area: EarthAreaWithClimate;
  isRevealed?: boolean; // New property to control visibility
  mapData?: {
    coordinates: {
      latitude: number;
      longitude: number;
      formatted: string;
    };
    maps: {
      googleMaps: string;
      googleMapsSearch: string;
      googleMapsEmbed: string;
      openStreetMap: string;
    };
    locationInfo: {
      name: string;
      climate: string;
      description: string;
    };
  };
}

export interface EarthAreaWithClimate {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  dayTemperature: number;
  nightTemperature: number;
  soilType: string;
  description: string;
  climateZone: string;
}

export interface ReverseGeocodeResult {
  city: string;
  state?: string;
  country: string;
  fullName: string;
  source: 'nominatim' | 'photon' | 'bigdatacloud' | 'fallback';
}

@Injectable({
  providedIn: 'root'
})
export class ClimateDataService {
  private readonly API_BASE_URL = 'http://localhost:3000/api/lst';
  private readonly POSTGREST_URL = 'http://localhost:3001';

  constructor(private http: HttpClient) {}

  /**
   * Reverse geocode coordinates to get exact city name using multiple providers
   */
  reverseGeocode(latitude: number, longitude: number): Observable<ReverseGeocodeResult> {
    console.log(`🌍 Reverse geocoding: ${latitude}, ${longitude}`);
    
    // Try multiple geocoding services in order of preference
    return this.tryNominatimGeocoding(latitude, longitude).pipe(
      catchError(() => {
        console.log('📍 Nominatim failed, trying Photon...');
        return this.tryPhotonGeocoding(latitude, longitude);
      }),
      catchError(() => {
        console.log('📍 Photon failed, trying BigDataCloud...');
        return this.tryBigDataCloudGeocoding(latitude, longitude);
      }),
      catchError(() => {
        console.log('📍 All geocoding services failed, using fallback');
        return of(this.getFallbackLocationName(latitude, longitude));
      })
    );
  }

  /**
   * OpenStreetMap Nominatim reverse geocoding (primary) - English only
   */
  private tryNominatimGeocoding(lat: number, lon: number): Observable<ReverseGeocodeResult> {
    const url = `https://nominatim.openstreetmap.org/reverse`;
    const params = new HttpParams()
      .set('format', 'json')
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('addressdetails', '1')
      .set('zoom', '10')
      .set('accept-language', 'en')  // Force English language
      .set('extratags', '1')
      .set('namedetails', '1');

    return this.http.get<any>(url, { params }).pipe(
      timeout(5000),
      retry(1),
      map(response => {
        if (response && response.address) {
          const addr = response.address;
          
          // Prefer English names from namedetails if available
          let city = addr.city || addr.town || addr.village || addr.hamlet || 
                    addr.suburb || addr.neighbourhood || addr.county;
          let state = addr.state || addr.province || addr.region;
          let country = addr.country;
          
          // Check for English names in namedetails
          if (response.namedetails) {
            city = response.namedetails['name:en'] || city;
          }

          // Manual translation for common non-English names
          city = this.translateToEnglish(city);
          state = this.translateToEnglish(state);
          country = this.translateToEnglish(country);

          if (city && country) {
            const fullName = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
            return {
              city,
              state,
              country,
              fullName,
              source: 'nominatim' as const
            };
          }
        }
        throw new Error('No valid address found');
      })
    );
  }

  /**
   * Photon reverse geocoding (secondary) - English language
   */
  private tryPhotonGeocoding(lat: number, lon: number): Observable<ReverseGeocodeResult> {
    const url = `https://photon.komoot.io/reverse`;
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lon', lon.toString())
      .set('limit', '1')
      .set('lang', 'en'); // Force English language

    return this.http.get<any>(url, { params }).pipe(
      timeout(5000),
      retry(1),
      map(response => {
        if (response && response.features && response.features.length > 0) {
          const props = response.features[0].properties;
          let city = props.city || props.name || props.locality;
          let state = props.state || props.region;
          let country = props.country;

          // Translate to English
          city = this.translateToEnglish(city);
          state = this.translateToEnglish(state);
          country = this.translateToEnglish(country);

          if (city && country) {
            const fullName = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
            return {
              city,
              state,
              country,
              fullName,
              source: 'photon' as const
            };
          }
        }
        throw new Error('No valid address found');
      })
    );
  }

  /**
   * BigDataCloud reverse geocoding (tertiary) - English language
   */
  private tryBigDataCloudGeocoding(lat: number, lon: number): Observable<ReverseGeocodeResult> {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client`;
    const params = new HttpParams()
      .set('latitude', lat.toString())
      .set('longitude', lon.toString())
      .set('localityLanguage', 'en'); // Already set to English

    return this.http.get<any>(url, { params }).pipe(
      timeout(5000),
      retry(1),
      map(response => {
        if (response) {
          let city = response.city || response.locality || response.localityInfo?.administrative?.[3]?.name;
          let state = response.principalSubdivision || response.localityInfo?.administrative?.[1]?.name;
          let country = response.countryName;

          // Translate to English as additional safety
          city = this.translateToEnglish(city);
          state = this.translateToEnglish(state);
          country = this.translateToEnglish(country);

          if (city && country) {
            const fullName = state ? `${city}, ${state}, ${country}` : `${city}, ${country}`;
            return {
              city,
              state,
              country,
              fullName,
              source: 'bigdatacloud' as const
            };
          }
        }
        throw new Error('No valid address found');
      })
    );
  }

  /**
   * Fallback location name when all geocoding services fail
   */
  private getFallbackLocationName(lat: number, lon: number): ReverseGeocodeResult {
    // Use the existing location name method as ultimate fallback
    const fallbackName = this.getLocationName(lat, lon);
    return {
      city: fallbackName,
      country: 'Unknown',
      fullName: fallbackName,
      source: 'fallback' as const
    };
  }

  /**
   * Debug method to check what's in the database
   */
  debugDatabaseContents(): Observable<any> {
    console.log('🔍 DEBUG: Checking database contents...');
    
    return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics`)
      .pipe(
        map(data => {
          console.log('📊 RAW DATABASE DUMP:');
          console.log('Total records:', data?.length || 0);
          
          if (data && data.length > 0) {
            data.forEach((record, index) => {
              console.log(`Record ${index + 1}:`, {
                latitude: record.latitude,
                longitude: record.longitude,
                band: record.band,
                value_mean: record.value_mean,
                value_max: record.value_max,
                value_min: record.value_min
              });
            });
            
            // Check unique coordinates
            const coords = data.map((r: any) => `${r.latitude},${r.longitude}`);
            const uniqueCoords = [...new Set(coords)];
            console.log('🌍 Unique coordinate pairs:', uniqueCoords);
          }
          
          return data;
        }),
        catchError(error => {
          console.error('❌ Database debug error:', error);
          return of([]);
        })
      );
  }

  /**
   * Get available areas from database for user selection with reverse geocoding
   */
  getAvailableAreas(limit: number = 50): Observable<EarthAreaWithClimate[]> {
    console.log('📋 Fetching available areas from NASA database...');
    
    // For small databases, get all available data without artificial limits
    return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?select=latitude,longitude,band`)
      .pipe(
        switchMap(data => {
          if (!data || data.length === 0) {
            console.warn('⚠️ No areas found in database, using fallback areas');
            return of(this.getFallbackAreas());
          }

          console.log(`📊 Raw database records: ${data.length}`);
          
          // Get all unique coordinates without aggressive filtering
          const uniqueLocations = this.getAllUniqueLocations(data);
          
          console.log(`🌍 Found ${uniqueLocations.length} unique locations from ${data.length} records`);
          console.log('📍 Locations:', uniqueLocations.map((loc: {latitude: number, longitude: number}) => `${loc.latitude},${loc.longitude}`));
          
          if (uniqueLocations.length === 0) {
            console.warn('⚠️ No unique locations found, using fallback');
            return of(this.getFallbackAreas());
          }
          
          // Process each location with reverse geocoding
          return this.processLocationsWithReverseGeocoding(uniqueLocations);
        }),
        catchError(error => {
          console.error('❌ Error fetching areas:', error);
          return of(this.getFallbackAreas());
        })
      );
  }

  /**
   * Process locations with reverse geocoding for accurate city names
   */
  private processLocationsWithReverseGeocoding(locations: {latitude: number, longitude: number}[]): Observable<EarthAreaWithClimate[]> {
    console.log(`🔍 Starting reverse geocoding for ${locations.length} locations...`);
    
    // Create array of geocoding observables
    const geocodeObservables = locations.map((location, index) => {
      return this.reverseGeocode(location.latitude, location.longitude).pipe(
        map(geocodeResult => {
          const climateZone = this.getClimateZone(location.latitude, location.longitude);
          
          console.log(`🏷️ Creating area ${index + 1}: ${geocodeResult.fullName} (${geocodeResult.source}) at ${location.latitude},${location.longitude} - Climate: ${climateZone}`);
          
          return {
            id: index + 1,
            name: geocodeResult.fullName,
            latitude: location.latitude,
            longitude: location.longitude,
            dayTemperature: 0, // Will be calculated when selected
            nightTemperature: 0, // Will be calculated when selected
            soilType: this.getSoilType(location.latitude, location.longitude),
            description: this.getAreaDescription(geocodeResult.city, 20, climateZone),
            climateZone
          } as EarthAreaWithClimate;
        }),
        catchError(error => {
          console.warn(`⚠️ Geocoding failed for ${location.latitude},${location.longitude}, using fallback`);
          const fallbackName = this.getLocationName(location.latitude, location.longitude);
          const climateZone = this.getClimateZone(location.latitude, location.longitude);
          
          return of({
            id: index + 1,
            name: fallbackName,
            latitude: location.latitude,
            longitude: location.longitude,
            dayTemperature: 0,
            nightTemperature: 0,
            soilType: this.getSoilType(location.latitude, location.longitude),
            description: this.getAreaDescription(fallbackName, 20, climateZone),
            climateZone
          } as EarthAreaWithClimate);
        })
      );
    });

    // Execute all geocoding requests in parallel with a delay between each
    return new Observable(observer => {
      const results: EarthAreaWithClimate[] = [];
      let completed = 0;

      geocodeObservables.forEach((obs, index) => {
        // Add a small delay between requests to be respectful to geocoding services
        setTimeout(() => {
          obs.subscribe({
            next: (area) => {
              results[index] = area;
              completed++;
              console.log(`✅ Geocoded ${completed}/${locations.length}: ${area.name}`);
              
              if (completed === locations.length) {
                observer.next(results);
                observer.complete();
              }
            },
            error: (error) => {
              console.error(`❌ Error geocoding location ${index}:`, error);
              completed++;
              if (completed === locations.length) {
                observer.next(results.filter(r => r)); // Filter out undefined results
                observer.complete();
              }
            }
          });
        }, index * 200); // 200ms delay between requests
      });
    });
  }

  /**
   * Get location data for a specific selected area
   */
  getLocationDataForArea(area: EarthAreaWithClimate): Observable<LocationData> {
    console.log(`🎯 Getting detailed data for: ${area.name}`);
    
    return this.processLocationDataWithRealTemperatures(area.latitude, area.longitude).pipe(
      map(locationData => {
        // Update the area with real temperature data
        area.dayTemperature = locationData.dayTemp;
        area.nightTemperature = locationData.nightTemp;
        
        return {
          ...locationData,
          area: area
        };
      })
    );
  }

  /**
   * Get ALL unique locations from database results (for small databases)
   */
  private getAllUniqueLocations(data: any[]): {latitude: number, longitude: number}[] {
    const locationMap = new Map<string, {latitude: number, longitude: number}>();
    
    console.log('🔍 Processing database records for unique locations...');
    
    for (const record of data) {
      if (record.latitude && record.longitude) {
        // Use exact coordinates as key to preserve all unique locations
        const lat = parseFloat(record.latitude);
        const lon = parseFloat(record.longitude);
        const key = `${lat},${lon}`;
        
        if (!locationMap.has(key)) {
          locationMap.set(key, { latitude: lat, longitude: lon });
          console.log(`➕ Added unique location: ${lat}, ${lon}`);
        }
      }
    }
    
    console.log(`📊 Total unique locations found: ${locationMap.size}`);
    return Array.from(locationMap.values());
  }

  /**
   * Get unique locations from database results (legacy method with limit)
   */
  private getUniqueLocations(data: any[], limit: number): {latitude: number, longitude: number}[] {
    const locationMap = new Map<string, {latitude: number, longitude: number}>();
    
    for (const record of data) {
      if (record.latitude && record.longitude) {
        const key = `${record.latitude.toFixed(2)},${record.longitude.toFixed(2)}`;
        if (!locationMap.has(key)) {
          locationMap.set(key, {
            latitude: parseFloat(record.latitude),
            longitude: parseFloat(record.longitude)
          });
          
          if (locationMap.size >= limit) break;
        }
      }
    }
    
    return Array.from(locationMap.values());
  }

  /**
   * Get fallback areas when database is unavailable
   */
  private getFallbackAreas(): EarthAreaWithClimate[] {
    const fallbackLocations = [
      { name: 'New York', lat: 40.7128, lon: -74.0060, climate: 'Temperate' },
      { name: 'London', lat: 51.5074, lon: -0.1278, climate: 'Temperate' },
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503, climate: 'Subtropical' },
      { name: 'Sydney', lat: -33.8688, lon: 151.2093, climate: 'Subtropical' },
      { name: 'Paris', lat: 48.8566, lon: 2.3522, climate: 'Temperate' },
      { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, climate: 'Subtropical' },
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777, climate: 'Tropical' },
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333, climate: 'Subtropical' },
      { name: 'Cairo', lat: 30.0444, lon: 31.2357, climate: 'Subtropical' },
      { name: 'Moscow', lat: 55.7558, lon: 37.6173, climate: 'Continental' },
      { name: 'Beijing', lat: 39.9042, lon: 116.4074, climate: 'Continental' },
      { name: 'Cape Town', lat: -33.9249, lon: 18.4241, climate: 'Temperate' },
      { name: 'Bangkok', lat: 13.7563, lon: 100.5018, climate: 'Tropical' },
      { name: 'Berlin', lat: 52.5200, lon: 13.4050, climate: 'Temperate' },
      { name: 'Buenos Aires', lat: -34.6118, lon: -58.3960, climate: 'Subtropical' }
    ];
    
    return fallbackLocations.map((location, index) => ({
      id: index + 1,
      name: location.name,
      latitude: location.lat,
      longitude: location.lon,
      dayTemperature: 0,
      nightTemperature: 0,
      soilType: this.getSoilType(location.lat, location.lon),
      description: this.getAreaDescription(location.name, 20, location.climate),
      climateZone: location.climate
    }));
  }

  /**
   * Get a random location with climate data from the database
   */
  getRandomLocationData(): Observable<LocationData | null> {
    console.log('🎲 Getting truly random location from NASA database...');
    
    // Try multiple randomization strategies for maximum diversity
    const randomStrategy = Math.floor(Math.random() * 3);
    
    if (randomStrategy === 0) {
      return this.getRandomLocationWithCount();
    } else if (randomStrategy === 1) {
      return this.getRandomLocationWithLargeOffset();
    } else {
      return this.getRandomLocationWithMultipleBatches();
    }
  }

  /**
   * Strategy 1: Use database count for precise randomization
   */
  private getRandomLocationWithCount(): Observable<LocationData | null> {
    console.log('📊 Strategy: Using database count for randomization');
    
    return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?select=count`)
      .pipe(
        switchMap(countResult => {
          let totalRecords = 10000; // Safe fallback
          if (countResult && Array.isArray(countResult)) {
            if (countResult.length > 0 && countResult[0].count) {
              totalRecords = countResult[0].count;
            } else {
              totalRecords = Math.max(countResult.length * 100, 5000);
            }
          }
          
          console.log(`📊 Database has ${totalRecords} records`);
          
          const maxOffset = Math.max(totalRecords - 10, 1000);
          const randomOffset = Math.floor(Math.random() * maxOffset);
          
          console.log(`🎯 Random offset: ${randomOffset}`);
          
          return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?limit=10&offset=${randomOffset}`);
        }),
        switchMap(data => this.processRandomBatch(data, 'count-based')),
        catchError(error => {
          console.error('❌ Count strategy failed:', error);
          return this.getRandomLocationWithLargeOffset();
        })
      );
  }

  /**
   * Strategy 2: Use large random offset without count
   */
  private getRandomLocationWithLargeOffset(): Observable<LocationData | null> {
    console.log('🎲 Strategy: Using large random offset');
    
    // Use a very large random offset (assuming database has thousands of records)
    const largeRandomOffset = Math.floor(Math.random() * 50000); // Up to 50k offset
    
    return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?limit=15&offset=${largeRandomOffset}`)
      .pipe(
        switchMap(data => {
          if (!data || data.length === 0) {
            // If offset is too large, try a smaller one
            const smallerOffset = Math.floor(Math.random() * 5000);
            console.log(`🔄 Offset too large, trying smaller: ${smallerOffset}`);
            return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?limit=15&offset=${smallerOffset}`);
          }
          return of(data);
        }),
        switchMap(data => this.processRandomBatch(data, 'large-offset')),
        catchError(error => {
          console.error('❌ Large offset strategy failed:', error);
          return this.getRandomLocationWithMultipleBatches();
        })
      );
  }

  /**
   * Strategy 3: Fetch multiple small batches and pick randomly
   */
  private getRandomLocationWithMultipleBatches(): Observable<LocationData | null> {
    console.log('🌍 Strategy: Using multiple random batches');
    
    // Generate 3 different random offsets
    const offsets = [
      Math.floor(Math.random() * 10000),
      Math.floor(Math.random() * 20000) + 10000,
      Math.floor(Math.random() * 15000) + 25000
    ];
    
    // Pick one offset randomly
    const selectedOffset = offsets[Math.floor(Math.random() * offsets.length)];
    console.log(`🎯 Selected batch offset: ${selectedOffset}`);
    
    return this.http.get<any[]>(`${this.POSTGREST_URL}/lst_statistics?limit=20&offset=${selectedOffset}`)
      .pipe(
        switchMap(data => this.processRandomBatch(data, 'multi-batch')),
        catchError(error => {
          console.error('❌ Multi-batch strategy failed, using fallback:', error);
          return of(this.getFallbackLocationData());
        })
      );
  }

  /**
   * Process a random batch of data and select one record
   */
  private processRandomBatch(data: any[], strategy: string): Observable<LocationData | null> {
    if (!data || data.length === 0) {
      console.warn(`⚠️ No data in ${strategy} batch, using fallback`);
      return of(this.getFallbackLocationData());
    }

    // Pick a random record from the batch
    const randomIndex = Math.floor(Math.random() * data.length);
    const record = data[randomIndex];
    const latitude = record.latitude;
    const longitude = record.longitude;
    
    console.log(`🌍 ${strategy}: Selected location ${randomIndex + 1}/${data.length}: ${latitude}°, ${longitude}°`);
    
    // Get comprehensive temperature data for this location
    return this.processLocationDataWithRealTemperatures(latitude, longitude);
  }

  /**
   * Process location data with enhanced real temperature calculations and reverse geocoding
   */
  private processLocationDataWithRealTemperatures(latitude: number, longitude: number): Observable<LocationData> {
    // Combine temperature data and reverse geocoding
    const temperatures$ = this.getRealDayNightTemperatures(latitude, longitude);
    const geocoding$ = this.reverseGeocode(latitude, longitude);
    
    return new Observable(observer => {
      Promise.all([
        temperatures$.toPromise(),
        geocoding$.toPromise()
      ]).then(([tempData, geocodeResult]) => {
        const { dayTemp, nightTemp, avgTemp } = tempData!;
        const locationName = geocodeResult!.fullName;
        const climateZone = this.getClimateZone(latitude, longitude);
        
        // Log real temperatures and geocoding result
        console.log(`🌡️ Real temps for ${locationName} (${geocodeResult!.source}): Day ${dayTemp}°C, Night ${nightTemp}°C (Climate: ${climateZone})`);
        
        const locationData: LocationData = {
          latitude,
          longitude,
          dayTemp,
          nightTemp,
          locationName,
          isRevealed: false, // Start hidden for guessing game
          area: {
            id: Math.floor(Math.random() * 1000),
            name: locationName,
            latitude,
            longitude,
            dayTemperature: dayTemp,
            nightTemperature: nightTemp,
            soilType: this.getSoilType(latitude, longitude),
            description: this.getAreaDescription(geocodeResult!.city, avgTemp, climateZone),
            climateZone
          }
        };

        // Add map data
        locationData.mapData = this.getLocationMapData(locationData);
        
        observer.next(locationData);
        observer.complete();
      }).catch(error => {
        console.error('❌ Error processing location data:', error);
        // Fallback without geocoding
        this.processLocationDataWithoutGeocoding(latitude, longitude).subscribe({
          next: data => observer.next(data),
          error: err => observer.error(err),
          complete: () => observer.complete()
        });
      });
    });
  }

  /**
   * Fallback method without geocoding
   */
  private processLocationDataWithoutGeocoding(latitude: number, longitude: number): Observable<LocationData> {
    return this.getRealDayNightTemperatures(latitude, longitude).pipe(
      map(({dayTemp, nightTemp, avgTemp}) => {
        const locationName = this.getLocationName(latitude, longitude);
        const climateZone = this.getClimateZone(latitude, longitude);
        
        console.log(`🌡️ Fallback temps for ${locationName}: Day ${dayTemp}°C, Night ${nightTemp}°C (Climate: ${climateZone})`);
        
        const locationData: LocationData = {
          latitude,
          longitude,
          dayTemp,
          nightTemp,
          locationName,
          isRevealed: false,
          area: {
            id: Math.floor(Math.random() * 1000),
            name: locationName,
            latitude,
            longitude,
            dayTemperature: dayTemp,
            nightTemperature: nightTemp,
            soilType: this.getSoilType(latitude, longitude),
            description: this.getAreaDescription(locationName, avgTemp, climateZone),
            climateZone
          }
        };

        locationData.mapData = this.getLocationMapData(locationData);
        return locationData;
      })
    );
  }

  /**
   * Get enhanced real day and night temperatures using multiple data points
   */
  private getRealDayNightTemperatures(latitude: number, longitude: number): Observable<{dayTemp: number, nightTemp: number, avgTemp: number}> {
    // Query more data points for better accuracy
    const dayStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Day_1km&limit=20`);
    const nightStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Night_1km&limit=20`);

    return new Observable(observer => {
      Promise.all([
        dayStats$.pipe(catchError(() => of([]))).toPromise(),
        nightStats$.pipe(catchError(() => of([]))).toPromise()
      ]).then(([dayStatsData, nightStatsData]) => {
        // Use enhanced real NASA LST data calculation
        const dayTemp = this.calculateRealTemperature(dayStatsData || [], 'day');
        const nightTemp = this.calculateRealTemperature(nightStatsData || [], 'night');
        const avgTemp = Math.round((dayTemp + nightTemp) / 2);

        observer.next({ dayTemp, nightTemp, avgTemp });
        observer.complete();
      });
    });
  }

  /**
   * Process location data with real temperature calculations
   */
  private processLocationDataWithTemperatures(latitude: number, longitude: number): Observable<LocationData> {
    return this.getDayNightTemperatures(latitude, longitude).pipe(
      map(({dayTemp, nightTemp, avgTemp}) => {
        const locationName = this.getLocationName(latitude, longitude);
        const climateZone = this.getClimateZone(latitude, longitude);
        
        const locationData: LocationData = {
          latitude,
          longitude,
          dayTemp,
          nightTemp,
          locationName,
          isRevealed: false, // Start hidden for guessing game
          area: {
            id: Math.floor(Math.random() * 1000),
            name: locationName,
            latitude,
            longitude,
            dayTemperature: dayTemp,
            nightTemperature: nightTemp,
            soilType: this.getSoilType(latitude, longitude),
            description: this.getAreaDescription(locationName, avgTemp, climateZone),
            climateZone
          }
        };

        // Add map data
        locationData.mapData = this.getLocationMapData(locationData);
        
        return locationData;
      })
    );
  }

  /**
   * Get climate data for specific coordinates
   */
  getClimateDataByCoordinates(latitude: number, longitude: number): Observable<ClimateData[]> {
    return this.http.get<any>(`${this.API_BASE_URL}/data-with-statistics?latitude=${latitude}&longitude=${longitude}`)
      .pipe(
        map(response => response.data || []),
        catchError(error => {
          console.error('Error fetching climate data:', error);
          return of([]);
        })
      );
  }

  /**
   * Get location data for specific coordinates using statistics
   */
  getLocationDataByCoordinates(latitude: number, longitude: number): Observable<LocationData> {
    return this.processLocationDataWithTemperatures(latitude, longitude);
  }

  /**
   * Get both day and night temperature data for a location using statistics
   */
  getDayNightTemperatures(latitude: number, longitude: number): Observable<{dayTemp: number, nightTemp: number, avgTemp: number}> {
    const dayStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Day_1km&limit=10`);
    const nightStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Night_1km&limit=10`);

    return new Observable(observer => {
      Promise.all([
        dayStats$.pipe(catchError(() => of([]))).toPromise(),
        nightStats$.pipe(catchError(() => of([]))).toPromise()
      ]).then(([dayStatsData, nightStatsData]) => {
        // Use real NASA LST data directly
        const dayTemp = this.calculateRealTemperature(dayStatsData || [], 'day');
        const nightTemp = this.calculateRealTemperature(nightStatsData || [], 'night');
        const avgTemp = Math.round((dayTemp + nightTemp) / 2);

        observer.next({ dayTemp, nightTemp, avgTemp });
        observer.complete();
      });
    });
  }

  /**
   * Calculate real temperature from NASA LST data using multiple statistical measures
   */
  private calculateRealTemperature(statsData: any[], timeOfDay: 'day' | 'night'): number {
    if (!statsData || statsData.length === 0) {
      // Fallback based on time of day - more realistic ranges
      return timeOfDay === 'day' ? this.getRandomTemp(20, 45) : this.getRandomTemp(5, 25);
    }

    // Process multiple temperature values to get the most accurate reading
    const validRecords = statsData.filter(record => 
      record.value_mean && !isNaN(record.value_mean) &&
      record.value_max && !isNaN(record.value_max) &&
      record.value_min && !isNaN(record.value_min)
    );

    if (validRecords.length === 0) {
      return timeOfDay === 'day' ? this.getRandomTemp(20, 45) : this.getRandomTemp(5, 25);
    }

    // Use different statistical approaches for day vs night
    let finalTemp: number;
    
    if (timeOfDay === 'day') {
      // For day temperatures, use the higher values (value_max or higher percentiles)
      const maxTemps = validRecords.map(record => this.kelvinToCelsius(record.value_max));
      const meanTemps = validRecords.map(record => this.kelvinToCelsius(record.value_mean));
      
      // Take the average of max temperatures for more realistic day peaks
      const avgMax = maxTemps.reduce((sum, temp) => sum + temp, 0) / maxTemps.length;
      const avgMean = meanTemps.reduce((sum, temp) => sum + temp, 0) / meanTemps.length;
      
      // Weight toward the higher temperatures for day readings
      finalTemp = Math.round((avgMax * 0.7) + (avgMean * 0.3));
      
    } else {
      // For night temperatures, use the lower values (value_min or lower percentiles)
      const minTemps = validRecords.map(record => this.kelvinToCelsius(record.value_min));
      const meanTemps = validRecords.map(record => this.kelvinToCelsius(record.value_mean));
      
      // Take the average of min temperatures for realistic night lows
      const avgMin = minTemps.reduce((sum, temp) => sum + temp, 0) / minTemps.length;
      const avgMean = meanTemps.reduce((sum, temp) => sum + temp, 0) / meanTemps.length;
      
      // Weight toward the lower temperatures for night readings
      finalTemp = Math.round((avgMin * 0.7) + (avgMean * 0.3));
    }

    // Ensure realistic temperature ranges
    finalTemp = Math.max(-50, Math.min(60, finalTemp)); // Clamp to realistic Earth temperatures
    
    return finalTemp;
  }

  /**
   * Calculate average temperature from statistics data using value_mean (legacy method)
   */
  private calculateAverageTemperature(statsData: any[]): number {
    if (!statsData || statsData.length === 0) {
      return this.getRandomTemp(15, 25); // Fallback
    }

    // Use value_mean from statistics and convert from Kelvin to Celsius
    const temperatures = statsData
      .filter(record => record.value_mean && !isNaN(record.value_mean))
      .map(record => this.kelvinToCelsius(record.value_mean));

    if (temperatures.length === 0) {
      return this.getRandomTemp(15, 25); // Fallback
    }

    const avgTemp = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    return Math.round(avgTemp);
  }

  /**
   * Process database record into LocationData (now uses real NASA temperature variation data)
   */
  private processLocationData(record: any): Observable<LocationData> {
    const latitude = record.latitude;
    const longitude = record.longitude;
    
    // Use value_mean from statistics for more accurate temperature
    let avgTemperature = 20; // Default
    if (record.value_mean && !isNaN(record.value_mean)) {
      avgTemperature = this.kelvinToCelsius(record.value_mean);
    } else if (record.value_center) {
      avgTemperature = this.kelvinToCelsius(parseFloat(record.value_center));
    }

    const locationName = this.getLocationName(latitude, longitude);
    const climateZone = this.getClimateZone(latitude, longitude);
    
    // Use real NASA data for temperature variation
    return this.getTemperatureVariation(latitude, longitude).pipe(
      map(tempVariation => {
        const dayTemp = Math.round(avgTemperature + tempVariation);
        const nightTemp = Math.round(avgTemperature - tempVariation);
        
        const locationData: LocationData = {
          latitude,
          longitude,
          dayTemp,
          nightTemp,
          locationName,
          isRevealed: false, // Start hidden for guessing game
          area: {
            id: Math.floor(Math.random() * 1000),
            name: locationName,
            latitude,
            longitude,
            dayTemperature: dayTemp,
            nightTemperature: nightTemp,
            soilType: this.getSoilType(latitude, longitude),
            description: this.getAreaDescription(locationName, avgTemperature, climateZone),
            climateZone
          }
        };

        // Add map data
        locationData.mapData = this.getLocationMapData(locationData);
        
        console.log(`🔧 Legacy method now uses real NASA variation: ${tempVariation}°C for ${locationName}`);
        
        return locationData;
      })
    );
  }

  /**
   * Get temperature variation based on climate zone (synchronous fallback)
   */
  private getTemperatureVariationSync(climateZone: string): number {
    const variationMap: {[key: string]: number} = {
      'Tropical': 5,              // Less day/night variation
      'Tropical Rainforest': 4,   // Very stable temperatures
      'Tropical Monsoon': 6,      // Moderate seasonal variation
      'Subtropical': 7,           // Moderate variation
      'Temperate': 10,            // Standard variation
      'Mediterranean': 8,         // Moderate variation
      'Continental': 15,          // High variation
      'Steppe': 12,              // High variation due to continental effect
      'Arid Desert': 20,         // Very high day/night variation
      'Cold Desert': 18,         // High variation but less than hot desert
      'Semi-Arid': 14,           // High variation
      'Subarctic': 12,           // Moderate to high variation
      'Tundra': 8,               // Lower variation due to extreme cold
      'Polar': 6                 // Lower variation due to extreme cold
    };
    
    return variationMap[climateZone] || 10;
  }

  /**
   * Get temperature variation based on real NASA data for specific coordinates
   */
  private getTemperatureVariation(latitude: number, longitude: number): Observable<number> {
    // Query both day and night temperature data to calculate real variation
    const dayStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Day_1km&limit=10`);
    const nightStats$ = this.http.get<any>(`${this.POSTGREST_URL}/lst_statistics?latitude=eq.${latitude}&longitude=eq.${longitude}&band=eq.LST_Night_1km&limit=10`);

    return new Observable(observer => {
      Promise.all([
        dayStats$.pipe(catchError(() => of([]))).toPromise(),
        nightStats$.pipe(catchError(() => of([]))).toPromise()
      ]).then(([dayStatsData, nightStatsData]) => {
        let variation = 10; // Default fallback

        if (dayStatsData && dayStatsData.length > 0 && nightStatsData && nightStatsData.length > 0) {
          // Calculate average day temperature from NASA data
          const dayTemps = dayStatsData
            .filter((record: any) => record.value_mean && !isNaN(record.value_mean))
            .map((record: any) => this.kelvinToCelsius(record.value_mean));

          // Calculate average night temperature from NASA data
          const nightTemps = nightStatsData
            .filter((record: any) => record.value_mean && !isNaN(record.value_mean))
            .map((record: any) => this.kelvinToCelsius(record.value_mean));

          if (dayTemps.length > 0 && nightTemps.length > 0) {
            const avgDayTemp = dayTemps.reduce((sum: number, temp: number) => sum + temp, 0) / dayTemps.length;
            const avgNightTemp = nightTemps.reduce((sum: number, temp: number) => sum + temp, 0) / nightTemps.length;
            
            // Real temperature variation from NASA data
            variation = Math.abs(avgDayTemp - avgNightTemp) / 2;
            
            // Ensure reasonable bounds (minimum 2°C, maximum 20°C variation)
            variation = Math.max(2, Math.min(20, variation));
            
            console.log(`🌡️ Real NASA variation for ${latitude},${longitude}: ${variation.toFixed(1)}°C (Day: ${avgDayTemp.toFixed(1)}°C, Night: ${avgNightTemp.toFixed(1)}°C)`);
          }
        }

        // If no data available, use climate zone as fallback
        if (variation === 10) {
          const climateZone = this.getClimateZone(latitude, longitude);
          const fallbackMap: {[key: string]: number} = {
            'Tropical': 5,              // Less day/night variation
            'Tropical Rainforest': 4,   // Very stable temperatures
            'Tropical Monsoon': 6,      // Moderate seasonal variation
            'Subtropical': 7,           // Moderate variation
            'Temperate': 10,            // Standard variation
            'Mediterranean': 8,         // Moderate variation
            'Continental': 15,          // High variation
            'Steppe': 12,              // High variation due to continental effect
            'Arid Desert': 20,         // Very high day/night variation
            'Cold Desert': 18,         // High variation but less than hot desert
            'Semi-Arid': 14,           // High variation
            'Subarctic': 12,           // Moderate to high variation
            'Tundra': 8,               // Lower variation due to extreme cold
            'Polar': 6                 // Lower variation due to extreme cold
          };
          variation = fallbackMap[climateZone] || 10;
          console.log(`⚠️ No NASA data for variation, using climate zone fallback: ${variation}°C (${climateZone})`);
        }

        observer.next(Math.round(variation));
        observer.complete();
      }).catch(error => {
        console.error('❌ Error calculating temperature variation:', error);
        // Ultimate fallback based on latitude and longitude
        const climateZone = this.getClimateZone(latitude, longitude);
        const fallbackMap: {[key: string]: number} = {
          'Tropical': 5, 'Tropical Rainforest': 4, 'Tropical Monsoon': 6,
          'Subtropical': 7, 'Mediterranean': 8, 'Temperate': 10, 
          'Continental': 15, 'Steppe': 12, 'Arid Desert': 20, 
          'Cold Desert': 18, 'Semi-Arid': 14, 'Subarctic': 12, 
          'Tundra': 8, 'Polar': 6
        };
        observer.next(fallbackMap[climateZone] || 10);
        observer.complete();
      });
    });
  }

  /**
   * Convert Kelvin to Celsius
   */
  private kelvinToCelsius(kelvin: number): number {
    return Math.round(kelvin - 273.15);
  }

  /**
   * Translate common French/local place names to English
   */
  private translateToEnglish(name: string | undefined): string {
    if (!name) return '';
    
    // French to English translations for common place names
    const translations: {[key: string]: string} = {
      // French regions/countries
      'France': 'France',
      'Allemagne': 'Germany', 
      'Espagne': 'Spain',
      'Italie': 'Italy',
      'Royaume-Uni': 'United Kingdom',
      'États-Unis': 'United States',
      'Pays-Bas': 'Netherlands',
      'Suisse': 'Switzerland',
      'Belgique': 'Belgium',
      'Autriche': 'Austria',
      'République tchèque': 'Czech Republic',
      'Pologne': 'Poland',
      'Hongrie': 'Hungary',
      'Grèce': 'Greece',
      'Portugal': 'Portugal',
      'Norvège': 'Norway',
      'Suède': 'Sweden',
      'Danemark': 'Denmark',
      'Finlande': 'Finland',
      
      // French cities
      'Paris': 'Paris',
      'Lyon': 'Lyon', 
      'Marseille': 'Marseille',
      'Toulouse': 'Toulouse',
      'Nice': 'Nice',
      'Nantes': 'Nantes',
      'Strasbourg': 'Strasbourg',
      'Montpellier': 'Montpellier',
      'Bordeaux': 'Bordeaux',
      'Lille': 'Lille',
      
      // French administrative divisions
      'Île-de-France': 'Île-de-France',
      'Provence-Alpes-Côte d\'Azur': 'Provence-Alpes-Côte d\'Azur',
      'Auvergne-Rhône-Alpes': 'Auvergne-Rhône-Alpes',
      'Nouvelle-Aquitaine': 'Nouvelle-Aquitaine',
      'Occitanie': 'Occitanie',
      'Hauts-de-France': 'Hauts-de-France',
      'Grand Est': 'Grand Est',
      'Pays de la Loire': 'Pays de la Loire',
      'Bretagne': 'Brittany',
      'Normandie': 'Normandy',
      
      // Other common translations
      'Londres': 'London',
      'Berlin': 'Berlin',
      'Madrid': 'Madrid',
      'Rome': 'Rome',
      'Amsterdam': 'Amsterdam',
      'Bruxelles': 'Brussels',
      'Genève': 'Geneva',
      'Zurich': 'Zurich',
      'Munich': 'Munich',
      'Vienne': 'Vienna',
      'Prague': 'Prague',
      'Budapest': 'Budapest',
      'Varsovie': 'Warsaw',
      'Stockholm': 'Stockholm',
      'Copenhague': 'Copenhagen',
      'Helsinki': 'Helsinki',
      'Oslo': 'Oslo',
      
      // Generic terms
      'Région': 'Region',
      'Département': 'Department',
      'Commune': 'Municipality',
      'Ville': 'City',
      'Arrondissement': 'District'
    };
    
    // Check for exact match first
    const exactMatch = translations[name];
    if (exactMatch) {
      return exactMatch;
    }
    
    // Check for partial matches (case insensitive)
    const lowerName = name.toLowerCase();
    for (const [french, english] of Object.entries(translations)) {
      if (lowerName.includes(french.toLowerCase()) || french.toLowerCase().includes(lowerName)) {
        return english;
      }
    }
    
    // If no translation found, return original name
    return name;
  }

  /**
   * Get city/location name based on coordinates
   */
  private getLocationName(lat: number, lon: number): string {
    // Try to find the nearest major city first
    const nearestCity = this.getNearestCity(lat, lon);
    if (nearestCity) {
      return nearestCity;
    }

    // Fallback to regional names based on coordinates
    return this.getRegionalName(lat, lon);
  }

  /**
   * Find nearest major city based on coordinates
   */
  private getNearestCity(lat: number, lon: number): string | null {
    const majorCities = [
      // North America
      { name: 'New York', lat: 40.7128, lon: -74.0060 },
      { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
      { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
      { name: 'Toronto', lat: 43.6532, lon: -79.3832 },
      { name: 'Mexico City', lat: 19.4326, lon: -99.1332 },
      
      // Europe
      { name: 'London', lat: 51.5074, lon: -0.1278 },
      { name: 'Paris', lat: 48.8566, lon: 2.3522 },
      { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
      { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
      { name: 'Rome', lat: 41.9028, lon: 12.4964 },
      { name: 'Moscow', lat: 55.7558, lon: 37.6173 },
      
      // Asia
      { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
      { name: 'Beijing', lat: 39.9042, lon: 116.4074 },
      { name: 'Shanghai', lat: 31.2304, lon: 121.4737 },
      { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
      { name: 'Delhi', lat: 28.7041, lon: 77.1025 },
      { name: 'Bangkok', lat: 13.7563, lon: 100.5018 },
      { name: 'Seoul', lat: 37.5665, lon: 126.9780 },
      
      // Middle East & Africa
      { name: 'Cairo', lat: 30.0444, lon: 31.2357 },
      { name: 'Istanbul', lat: 41.0082, lon: 28.9784 },
      { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
      { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
      { name: 'Lagos', lat: 6.5244, lon: 3.3792 },
      
      // South America
      { name: 'São Paulo', lat: -23.5505, lon: -46.6333 },
      { name: 'Buenos Aires', lat: -34.6118, lon: -58.3960 },
      { name: 'Lima', lat: -12.0464, lon: -77.0428 },
      
      // Oceania
      { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
      { name: 'Melbourne', lat: -37.8136, lon: 144.9631 },
      { name: 'Auckland', lat: -36.8485, lon: 174.7633 }
    ];

    let nearestCity = null;
    let minDistance = Infinity;

    for (const city of majorCities) {
      const distance = this.calculateDistance(lat, lon, city.lat, city.lon);
      if (distance < minDistance && distance < 500) { // Within 500km
        minDistance = distance;
        nearestCity = city.name;
      }
    }

    return nearestCity;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get regional name based on coordinates when no major city is nearby
   */
  private getRegionalName(lat: number, lon: number): string {
    // Determine continent and region
    if (lat >= -60 && lat <= 75 && lon >= -180 && lon <= -30) {
      // Americas
      if (lat >= 23.5) return 'North American Plains';
      if (lat >= 0) return 'Central American Highlands';
      return 'South American Region';
    }
    
    if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 40) {
      // Europe
      if (lon <= 15) return 'Western European Region';
      return 'Eastern European Plains';
    }
    
    if (lat >= -35 && lat <= 55 && lon >= 25 && lon <= 60) {
      // Africa/Middle East
      if (lat >= 15) return 'Northern African Region';
      if (lat >= -10) return 'Central African Basin';
      return 'Southern African Region';
    }
    
    if (lat >= -50 && lat <= 75 && lon >= 60 && lon <= 180) {
      // Asia/Oceania
      if (lat >= 50) return 'Siberian Region';
      if (lat >= 20) return 'Central Asian Steppes';
      if (lat >= -10) return 'Southeast Asian Region';
      return 'Australian Outback';
    }

    // Geographic regions based on actual coordinates
    return this.getGeographicRegion(lat, lon);
  }

  /**
   * Get geographic region based on actual coordinates
   */
  private getGeographicRegion(lat: number, lon: number): string {
    // Ocean and water body detection
    if (this.isOceanRegion(lat, lon)) {
      return this.getOceanRegionName(lat, lon);
    }

    // Major geographic regions
    if (lat >= -60 && lat <= 83 && lon >= -180 && lon <= -30) {
      // Americas
      if (lat >= 60) return 'Alaska Region';
      if (lat >= 49) return 'Canadian Prairies';
      if (lat >= 25.5) {
        if (lon >= -125 && lon <= -66) return 'United States Plains';
        if (lon >= -125) return 'US West Coast';
        return 'US East Coast';
      }
      if (lat >= 14) return 'Mexico & Central America';
      if (lat >= -23) return 'Amazon Basin';
      if (lat >= -35) return 'Brazilian Highlands';
      return 'Patagonia Region';
    }
    
    if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 60) {
      // Europe & Western Asia
      if (lat >= 60) return 'Scandinavian Peninsula';
      if (lon <= 30) {
        if (lat >= 50) return 'Northern European Plains';
        if (lat >= 40) return 'Mediterranean Region';
        return 'Southern Europe';
      }
      if (lat >= 55) return 'Russian Taiga';
      if (lat >= 45) return 'Eastern European Steppes';
      return 'Caucasus Region';
    }
    
    if (lat >= -35 && lat <= 38 && lon >= -18 && lon <= 52) {
      // Africa & Middle East
      if (lat >= 25) {
        if (lon >= 32) return 'Arabian Peninsula';
        return 'Sahara Desert';
      }
      if (lat >= 10) return 'Sahel Region';
      if (lat >= 0) return 'Congo Basin';
      if (lat >= -15) return 'East African Highlands';
      if (lat >= -25) return 'Zambezi Basin';
      return 'Kalahari Region';
    }
    
    if (lat >= -50 && lat <= 75 && lon >= 60 && lon <= 180) {
      // Asia & Oceania
      if (lat >= 65) return 'Siberian Tundra';
      if (lat >= 50) return 'Central Siberia';
      if (lat >= 35) {
        if (lon >= 135) return 'Manchurian Plains';
        if (lon >= 100) return 'Mongolian Steppes';
        return 'Central Asian Desert';
      }
      if (lat >= 20) {
        if (lon >= 135) return 'East China Plains';
        if (lon >= 100) return 'Southeast Asian Highlands';
        return 'Indian Subcontinent';
      }
      if (lat >= -10) {
        if (lon >= 140) return 'Indonesian Archipelago';
        return 'Indochina Peninsula';
      }
      if (lat >= -30) return 'Northern Australia';
      return 'Australian Outback';
    }

    // Pacific Islands and remote regions
    if (lon >= 120 || lon <= -120) {
      if (lat >= 20) return 'North Pacific Region';
      if (lat >= 0) return 'Equatorial Pacific';
      return 'South Pacific Islands';
    }

    // Atlantic regions
    if (lon >= -60 && lon <= 20) {
      if (lat >= 40) return 'North Atlantic Region';
      if (lat >= 0) return 'Tropical Atlantic';
      return 'South Atlantic Region';
    }

    // Indian Ocean regions
    if (lon >= 40 && lon <= 100) {
      if (lat >= 0) return 'Arabian Sea Region';
      return 'Indian Ocean Basin';
    }

    // Default fallback
    return 'Remote Geographic Region';
  }

  /**
   * Detect if coordinates are in ocean/water regions
   */
  private isOceanRegion(lat: number, lon: number): boolean {
    // Major ocean regions (simplified detection)
    // Pacific Ocean
    if ((lon >= 120 && lon <= 180) || (lon >= -180 && lon <= -120)) {
      return true;
    }
    
    // Atlantic Ocean
    if ((lat >= -60 && lat <= 75) && (lon >= -80 && lon <= 20) && 
        !((lat >= 25 && lat <= 75 && lon >= -25 && lon <= 50) || // Exclude Europe/Africa
          (lat >= -35 && lat <= 35 && lon >= -60 && lon <= -35))) { // Exclude Americas
      return true;
    }
    
    // Indian Ocean
    if (lat >= -60 && lat <= 30 && lon >= 20 && lon <= 120 &&
        !(lat >= -35 && lat <= 35 && lon >= 20 && lon <= 52)) { // Exclude Africa
      return true;
    }
    
    // Arctic Ocean
    if (lat >= 75) {
      return true;
    }
    
    // Southern Ocean
    if (lat <= -60) {
      return true;
    }
    
    return false;
  }

  /**
   * Get specific ocean region name
   */
  private getOceanRegionName(lat: number, lon: number): string {
    if (lat >= 75) return 'Arctic Ocean Region';
    if (lat <= -60) return 'Antarctic Waters';
    
    if ((lon >= 120 && lon <= 180) || (lon >= -180 && lon <= -120)) {
      if (lat >= 20) return 'North Pacific Basin';
      if (lat >= -20) return 'Equatorial Pacific';
      return 'South Pacific Basin';
    }
    
    if (lon >= -80 && lon <= 20) {
      if (lat >= 25) return 'North Atlantic Basin';
      if (lat >= -25) return 'Equatorial Atlantic';
      return 'South Atlantic Basin';
    }
    
    if (lon >= 20 && lon <= 120) {
      if (lat >= 10) return 'Arabian Sea';
      return 'Indian Ocean Basin';
    }
    
    return 'Open Ocean Region';
  }

  /**
   * Determine climate zone based on latitude and longitude (considering geographic regions)
   */
  private getClimateZone(latitude: number, longitude?: number): string {
    const absLat = Math.abs(latitude);
    
    // If longitude is provided, use geographic-specific climate classification
    if (longitude !== undefined) {
      // Sahara Desert (North Africa) - includes Tamanrasset, Algeria
      if (latitude >= 15 && latitude <= 35 && longitude >= -17 && longitude <= 35) {
        return 'Arid Desert';
      }
      
      // Arabian Desert (Middle East)
      if (latitude >= 15 && latitude <= 35 && longitude >= 35 && longitude <= 60) {
        return 'Arid Desert';
      }
      
      // Gobi Desert (Central Asia)
      if (latitude >= 38 && latitude <= 50 && longitude >= 90 && longitude <= 120) {
        return 'Cold Desert';
      }
      
      // Atacama Desert (South America)
      if (latitude >= -30 && latitude <= -15 && longitude >= -75 && longitude <= -65) {
        return 'Arid Desert';
      }
      
      // Kalahari Desert (Southern Africa)
      if (latitude >= -30 && latitude <= -20 && longitude >= 15 && longitude <= 30) {
        return 'Semi-Arid';
      }
      
      // Australian Outback
      if (latitude >= -35 && latitude <= -15 && longitude >= 115 && longitude <= 150) {
        return 'Arid Desert';
      }
      
      // Mediterranean Climate Zones
      if ((latitude >= 30 && latitude <= 45 && longitude >= -10 && longitude <= 45) || // Mediterranean Basin
          (latitude >= 30 && latitude <= 40 && longitude >= -125 && longitude <= -115) || // California
          (latitude >= -40 && latitude <= -30 && longitude >= -75 && longitude <= -65) || // Chile
          (latitude >= -35 && latitude <= -30 && longitude >= 115 && longitude <= 125) || // SW Australia
          (latitude >= -35 && latitude <= -30 && longitude >= 18 && longitude <= 25)) { // South Africa
        return 'Mediterranean';
      }
      
      // Tropical Rainforest (Amazon, Congo, Southeast Asia)
      if ((latitude >= -10 && latitude <= 10 && longitude >= -80 && longitude <= -35) || // Amazon
          (latitude >= -5 && latitude <= 10 && longitude >= 10 && longitude <= 30) || // Congo Basin
          (latitude >= -10 && latitude <= 15 && longitude >= 95 && longitude <= 155)) { // SE Asia/Indonesia
        return 'Tropical Rainforest';
      }
      
      // Monsoon Climate (Indian Subcontinent, Southeast Asia)
      if (latitude >= 8 && latitude <= 30 && longitude >= 68 && longitude <= 100) {
        return 'Tropical Monsoon';
      }
      
      // Steppe/Prairie (Great Plains, Eurasian Steppe)
      if ((latitude >= 30 && latitude <= 50 && longitude >= -110 && longitude <= -95) || // Great Plains
          (latitude >= 45 && latitude <= 55 && longitude >= 20 && longitude <= 120)) { // Eurasian Steppe
        return 'Steppe';
      }
      
      // Tundra (Northern Canada, Siberia)
      if (latitude >= 60 && (longitude >= -170 && longitude <= -50 || longitude >= 40 && longitude <= 180)) {
        return 'Tundra';
      }
      
      // Subarctic (Taiga/Boreal Forest)
      if (latitude >= 50 && latitude <= 70 && (longitude >= -170 && longitude <= -50 || longitude >= 20 && longitude <= 180)) {
        return 'Subarctic';
      }
    }
    
    // Fallback to latitude-based classification with improved boundaries
    if (absLat >= 66.5) return 'Polar';
    if (absLat >= 60) return 'Subarctic';
    if (absLat >= 50) return 'Continental';
    if (absLat >= 35) return 'Temperate';
    if (absLat >= 23.5) return 'Subtropical';
    return 'Tropical';
  }

  /**
   * Determine soil type based on coordinates
   */
  private getSoilType(lat: number, lon: number): string {
    const soilTypes = ['Sandy', 'Clay-rich', 'Volcanic', 'Rocky', 'Loamy', 'Peaty'];
    return soilTypes[Math.floor(Math.abs(lat * lon) * 10) % soilTypes.length];
  }

  /**
   * Generate area description
   */
  private getAreaDescription(name: string, temp: number, climate: string): string {
    const tempDescription = this.getTemperatureDescription(temp);
    const climateDescription = this.getClimateDescription(climate);
    const cityType = this.getCityType(name);
    
    return `${climate} ${cityType} with ${tempDescription} temperatures. ${name} ${climateDescription}`;
  }

  /**
   * Get temperature description
   */
  private getTemperatureDescription(temp: number): string {
    if (temp > 30) return 'hot';
    if (temp > 25) return 'warm';
    if (temp > 15) return 'moderate';
    if (temp > 5) return 'cool';
    return 'cold';
  }

  /**
   * Get climate-specific description
   */
  private getClimateDescription(climate: string): string {
    const descriptions: {[key: string]: string} = {
      'Tropical': 'offers year-round growing seasons with high biodiversity potential',
      'Tropical Rainforest': 'provides ideal conditions for diverse tropical crops with abundant rainfall',
      'Tropical Monsoon': 'features distinct wet and dry seasons perfect for rice and monsoon crops',
      'Subtropical': 'provides excellent conditions for diverse crop cultivation',
      'Mediterranean': 'offers perfect conditions for olives, grapes, and citrus fruits',
      'Temperate': 'features seasonal variations ideal for traditional agriculture',
      'Continental': 'experiences distinct seasons suitable for grain production',
      'Steppe': 'supports grassland agriculture and grazing with moderate rainfall',
      'Arid Desert': 'requires advanced irrigation and specialized desert agriculture techniques',
      'Cold Desert': 'demands specialized cold-climate and drought-resistant cultivation methods',
      'Semi-Arid': 'supports drought-resistant crops with careful water management',
      'Subarctic': 'allows short-season crops adapted to cool summers',
      'Tundra': 'requires greenhouse cultivation and cold-adapted techniques',
      'Polar': 'requires specialized techniques for short-season cultivation'
    };
    
    return descriptions[climate] || 'presents unique agricultural challenges and opportunities';
  }

  /**
   * Determine if location is a city or region
   */
  private getCityType(name: string): string {
    const cityNames = [
      'New York', 'Los Angeles', 'Chicago', 'Toronto', 'Mexico City',
      'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Moscow',
      'Tokyo', 'Beijing', 'Shanghai', 'Mumbai', 'Delhi', 'Bangkok', 'Seoul',
      'Cairo', 'Istanbul', 'Dubai', 'Cape Town', 'Lagos',
      'São Paulo', 'Buenos Aires', 'Lima',
      'Sydney', 'Melbourne', 'Auckland'
    ];
    
    return cityNames.some(city => name.includes(city)) ? 'metropolitan area' : 'region';
  }

  /**
   * Get random temperature within range
   */
  private getRandomTemp(min: number, max: number): number {
    return Math.round(Math.random() * (max - min) + min);
  }

  /**
   * Generate Google Maps URL for given coordinates
   */
  getGoogleMapsUrl(latitude: number, longitude: number, zoom: number = 10): string {
    return `https://www.google.com/maps/@${latitude},${longitude},${zoom}z`;
  }

  /**
   * Generate Google Maps search URL with location name
   */
  getGoogleMapsSearchUrl(locationName: string, latitude?: number, longitude?: number): string {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/${encodeURIComponent(locationName)}/@${latitude},${longitude},12z`;
    }
    return `https://www.google.com/maps/search/${encodeURIComponent(locationName)}`;
  }

  /**
   * Generate Google Maps embed URL for iframe (requires API key for production)
   */
  getGoogleMapsEmbedUrl(latitude: number, longitude: number, zoom: number = 10, apiKey?: string): string {
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${latitude},${longitude}&zoom=${zoom}`;
    }
    // Fallback to basic embed (may have limitations)
    return `https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=${zoom}&output=embed`;
  }

  /**
   * Generate OpenStreetMap URL as alternative to Google Maps
   */
  getOpenStreetMapUrl(latitude: number, longitude: number, zoom: number = 10): string {
    return `https://www.openstreetmap.org/#map=${zoom}/${latitude}/${longitude}`;
  }

  /**
   * Get map data for location including various map service URLs
   */
  getLocationMapData(locationData: LocationData): {
    coordinates: {
      latitude: number;
      longitude: number;
      formatted: string;
    };
    maps: {
      googleMaps: string;
      googleMapsSearch: string;
      googleMapsEmbed: string;
      openStreetMap: string;
    };
    locationInfo: {
      name: string;
      climate: string;
      description: string;
    };
  } {
    return {
      coordinates: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        formatted: `${locationData.latitude.toFixed(4)}°, ${locationData.longitude.toFixed(4)}°`
      },
      maps: {
        googleMaps: this.getGoogleMapsUrl(locationData.latitude, locationData.longitude),
        googleMapsSearch: this.getGoogleMapsSearchUrl(locationData.locationName, locationData.latitude, locationData.longitude),
        googleMapsEmbed: this.getGoogleMapsEmbedUrl(locationData.latitude, locationData.longitude),
        openStreetMap: this.getOpenStreetMapUrl(locationData.latitude, locationData.longitude)
      },
      locationInfo: {
        name: locationData.locationName,
        climate: locationData.area.climateZone,
        description: locationData.area.description
      }
    };
  }

  /**
   * Fallback location data when API fails
   */
  private getFallbackLocationData(): LocationData {
    const fallbackLocations = [
      { lat: 40.7128, lon: -74.0060, dayTemp: 22, nightTemp: 12 }, // New York
      { lat: 51.5074, lon: -0.1278, dayTemp: 18, nightTemp: 8 },   // London
      { lat: 35.6762, lon: 139.6503, dayTemp: 25, nightTemp: 15 }, // Tokyo
      { lat: -33.8688, lon: 151.2093, dayTemp: 28, nightTemp: 18 }, // Sydney
      { lat: 48.8566, lon: 2.3522, dayTemp: 20, nightTemp: 10 },   // Paris
      { lat: 34.0522, lon: -118.2437, dayTemp: 26, nightTemp: 16 }, // Los Angeles
      { lat: 19.0760, lon: 72.8777, dayTemp: 32, nightTemp: 24 },  // Mumbai
      { lat: -23.5505, lon: -46.6333, dayTemp: 24, nightTemp: 14 }, // São Paulo
    ];
    
    const location = fallbackLocations[Math.floor(Math.random() * fallbackLocations.length)];
    const locationName = this.getLocationName(location.lat, location.lon);
    const climateZone = this.getClimateZone(location.lat, location.lon);
    
    const locationData: LocationData = {
      latitude: location.lat,
      longitude: location.lon,
      dayTemp: location.dayTemp,
      nightTemp: location.nightTemp,
      locationName: locationName,
      isRevealed: false, // Start hidden for guessing game
      area: {
        id: Math.floor(Math.random() * 1000),
        name: locationName,
        latitude: location.lat,
        longitude: location.lon,
        dayTemperature: location.dayTemp,
        nightTemperature: location.nightTemp,
        soilType: this.getSoilType(location.lat, location.lon),
        description: this.getAreaDescription(locationName, location.dayTemp, climateZone),
        climateZone: climateZone
      }
    };

    // Add map data
    locationData.mapData = this.getLocationMapData(locationData);
    
    return locationData;
  }

  /**
   * Evaluate NDVI value and return status with color coding
   * NDVI -1 to 0.2 = KO (red), 0.2 to 1 = OK (green)
   */
  evaluateNDVIStatus(ndviValue: number): NDVIStatus {
    if (ndviValue < -1 || ndviValue > 1) {
      return {
        value: ndviValue,
        status: 'unknown',
        color: 'gray',
        description: 'Invalid NDVI value'
      };
    }
    
    if (ndviValue >= -1 && ndviValue < 0.2) {
      return {
        value: ndviValue,
        status: 'KO',
        color: 'red',
        description: 'Poor vegetation health'
      };
    } else if (ndviValue >= 0.2 && ndviValue <= 1) {
      return {
        value: ndviValue,
        status: 'OK',
        color: 'green',
        description: 'Good vegetation health'
      };
    }

    return {
      value: ndviValue,
      status: 'unknown',
      color: 'gray',
      description: 'Unknown vegetation status'
    };
  }

  /**
   * Get NDVI data using get_vgt_data_with_statistics function
   */
  getNDVIDataForLocation(latitude: number, longitude: number): Observable<VegetationData[]> {
    const params = new HttpParams()
      .set('target_latitude', 'eq.' + latitude.toFixed(6))
      .set('target_longitude', 'eq.' + longitude.toFixed(6))
      .set('band_filter', 'eq.NDVI');

    return this.http.get<VegetationData[]>(`${this.POSTGREST_URL}/rpc/get_vgt_data_with_statistics`, { params }).pipe(
      timeout(10000),
      retry(2),
      catchError(error => {
        console.error('Error fetching NDVI data:', error);
        return of([]);
      })
    );
  }

  /**
   * Get NDVI status for a specific location
   */
  getNDVIStatusForLocation(latitude: number, longitude: number): Observable<NDVIStatus | null> {
    return this.getNDVIDataForLocation(latitude, longitude).pipe(
      map(data => {
        if (data && data.length > 0) {
          // Get the most recent NDVI data
          const sortedData = data.sort((a, b) => 
            new Date(b.calendar_date).getTime() - new Date(a.calendar_date).getTime()
          );
          const latestNDVI = sortedData[0];
          return this.evaluateNDVIStatus(latestNDVI.value_mean);
        }
        return null;
      }),
      catchError(error => {
        console.error('Error getting NDVI status:', error);
        return of(null);
      })
    );
  }
}
