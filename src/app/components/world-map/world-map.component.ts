import { Component, Input, OnInit, OnChanges } from '@angular/core';

@Component({
  selector: 'app-world-map',
  templateUrl: './world-map.component.html',
  styleUrls: ['./world-map.component.scss']
})
export class WorldMapComponent implements OnInit, OnChanges {
  @Input() latitude: number = 0;
  @Input() longitude: number = 0;
  @Input() locationName: string = 'Unknown Location';
  @Input() showPin: boolean = true;

  pinX: number = 50; // Default center
  pinY: number = 50; // Default center

  ngOnInit() {
    this.calculatePinPosition();
  }

  ngOnChanges() {
    this.calculatePinPosition();
  }

  /**
   * Convert latitude/longitude to X,Y position on the map (percentage based)
   */
  private calculatePinPosition() {
    // Convert longitude (-180 to 180) to X position (0% to 100%)
    this.pinX = ((this.longitude + 180) / 360) * 100;
    
    // Convert latitude (90 to -90) to Y position (0% to 100%)
    // Note: We flip Y because map Y=0 is top, but latitude 90 is north (top)
    this.pinY = ((90 - this.latitude) / 180) * 100;

    // Clamp values to ensure they stay within map bounds
    this.pinX = Math.max(0, Math.min(100, this.pinX));
    this.pinY = Math.max(0, Math.min(100, this.pinY));
  }

  /**
   * Get continent name for the location (simplified for children)
   */
  getContinentName(): string {
    const lat = this.latitude;
    const lon = this.longitude;

    if (lat >= -60 && lat <= 83 && lon >= -180 && lon <= -30) {
      if (lat >= 15) return 'North America';
      return 'South America';
    }
    
    if (lat >= 35 && lat <= 71 && lon >= -10 && lon <= 60) {
      return 'Europe';
    }
    
    if (lat >= -35 && lat <= 40 && lon >= -18 && lon <= 52) {
      return 'Africa';
    }
    
    if (lat >= -50 && lat <= 75 && lon >= 60 && lon <= 180) {
      if (lat >= -10) return 'Asia';
      return 'Australia';
    }

    // Ocean regions
    return 'Ocean';
  }

  /**
   * Get simple climate description for children
   */
  getSimpleClimate(): string {
    const absLat = Math.abs(this.latitude);
    if (absLat < 23.5) return '🌴 Tropical (Hot & Sunny)';
    if (absLat < 50) return '🌡️ Temperate (Mild Weather)';
    if (absLat < 66.5) return '❄️ Cool (Four Seasons)';
    return '🧊 Polar (Very Cold)';
  }
}
