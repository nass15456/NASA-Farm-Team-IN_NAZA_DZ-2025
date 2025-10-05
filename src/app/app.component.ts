import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EarthArea, EarthAreaExtended } from './game-data.service';
import { ClimateDataService, LocationData } from './climate-data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Earth Agriculture Game';
  currentScreen: 'planet' | 'area-selection' | 'farming' | 'quiz' = 'planet';
  selectedArea: EarthAreaExtended | null = null;
  isLoading = true;
  isLoadingData = false;
  loadingMessage = '';
  currentLocationData: LocationData | null = null;
  availableAreas: any[] = [];

  constructor(
    private climateDataService: ClimateDataService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    // Simulate loading time for the spinning Earth
    setTimeout(() => {
      this.isLoading = false;
    }, 3000);
  }

  onPlanetClick() {
    this.isLoadingData = true;
    this.loadingMessage = 'Loading database contents...';
    
    // First debug the database contents
    this.climateDataService.debugDatabaseContents().subscribe({
      next: (debugData) => {
        console.log('✅ Database debug completed');
        this.loadingMessage = 'Getting exact city names from coordinates...';
        
        // Now load available areas for user selection with reverse geocoding
        this.climateDataService.getAvailableAreas(30).subscribe({
          next: (areas) => {
            console.log(`🎯 Final areas received: ${areas.length}`);
            this.availableAreas = areas;
            this.currentScreen = 'area-selection';
            this.isLoadingData = false;
            this.loadingMessage = '';
          },
          error: (error) => {
            console.error('Error loading available areas:', error);
            this.isLoadingData = false;
            this.loadingMessage = '';
          }
        });
      },
      error: (error) => {
        console.error('Error debugging database:', error);
        this.loadingMessage = 'Fetching area information...';
        
        // Still try to load areas even if debug fails
        this.climateDataService.getAvailableAreas(30).subscribe({
          next: (areas) => {
            this.availableAreas = areas;
            this.currentScreen = 'area-selection';
            this.isLoadingData = false;
            this.loadingMessage = '';
          },
          error: (error) => {
            console.error('Error loading available areas:', error);
            this.isLoadingData = false;
            this.loadingMessage = '';
          }
        });
      }
    });
  }

  onAreaSelected(area: any) {
    this.isLoadingData = true;
    
    // Get detailed climate data for the selected area
    this.climateDataService.getLocationDataForArea(area).subscribe({
      next: (locationData) => {
        this.currentLocationData = locationData;
        this.selectedArea = this.convertToEarthArea(locationData);
        this.currentScreen = 'farming';
        this.isLoadingData = false;
      },
      error: (error) => {
        console.error('Error loading area details:', error);
        this.isLoadingData = false;
      }
    });
  }

  private convertToEarthArea(locationData: LocationData): EarthAreaExtended {
    return {
      id: locationData.area.id,
      name: locationData.area.name,
      temperature: Math.round((locationData.dayTemp + locationData.nightTemp) / 2),
      soilType: locationData.area.soilType,
      description: locationData.area.description,
      coordinates: { 
        x: ((locationData.longitude + 180) / 360) * 100, 
        y: ((90 - locationData.latitude) / 180) * 100 
      },
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      dayTemperature: locationData.dayTemp,
      nightTemperature: locationData.nightTemp,
      climateZone: locationData.area.climateZone,
      realData: true
    };
  }



  onStartQuiz() {
    this.currentScreen = 'quiz';
  }

  onBackToPlanet() {
    this.currentScreen = 'planet';
    this.selectedArea = null;
  }

  onBackToFarming() {
    this.currentScreen = 'farming';
  }

  onShowAreaSelection() {
    this.currentScreen = 'area-selection';
  }

  /**
   * Sanitize map URL for iframe src
   */
  getTrustedMapUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Get Google Maps link safely
   */
  getMapLink(type: 'google' | 'osm'): string | null {
    if (!this.currentLocationData?.mapData) return null;
    
    return type === 'google' 
      ? this.currentLocationData.mapData.maps.googleMaps
      : this.currentLocationData.mapData.maps.openStreetMap;
  }
}
