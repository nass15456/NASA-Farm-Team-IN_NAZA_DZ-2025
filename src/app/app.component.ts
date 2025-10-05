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
  currentLocationData: LocationData | null = null;

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
    
    this.climateDataService.getRandomLocationData().subscribe({
      next: (locationData) => {
        if (locationData) {
          this.currentLocationData = locationData;
          this.selectedArea = this.convertToEarthArea(locationData);
          this.currentScreen = 'farming';
        }
        this.isLoadingData = false;
      },
      error: (error) => {
        console.error('Error loading climate data:', error);
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

  onAreaSelected(area: EarthArea) {
    this.selectedArea = area;
    this.currentScreen = 'farming';
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
