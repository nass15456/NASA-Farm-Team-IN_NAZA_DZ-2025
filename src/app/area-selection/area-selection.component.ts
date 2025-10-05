import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { EarthAreaWithClimate, ClimateDataService, NDVIStatus, VegetationData } from '../climate-data.service';

@Component({
  selector: 'app-area-selection',
  templateUrl: './area-selection.component.html',
  styleUrls: ['./area-selection.component.scss']
})
export class AreaSelectionComponent implements OnInit {
  @Input() availableAreas: EarthAreaWithClimate[] = [];
  @Output() areaSelected = new EventEmitter<EarthAreaWithClimate>();
  @Output() backToEarth = new EventEmitter<void>();
  
  // NDVI data for each area
  areaVegetationData: Map<number, { ndviStatus?: NDVIStatus; isLoading: boolean; data?: VegetationData[] }> = new Map();
  
  constructor(private climateService: ClimateDataService) {}

  ngOnInit() {
    // Areas are now passed from parent component via Input
    console.log(`🌍 Area selection loaded with ${this.availableAreas.length} areas`);
    
    // Load NDVI data for each area
    this.loadVegetationDataForAreas();
  }

  loadVegetationDataForAreas() {
    this.availableAreas.forEach(area => {
      // Initialize loading state
      this.areaVegetationData.set(area.id, { isLoading: true });
      
      // Fetch vegetation data for this area
      this.climateService.getClimateWithVegetationData(area.latitude, area.longitude)
        .subscribe({
          next: (result) => {
            this.areaVegetationData.set(area.id, {
              isLoading: false,
              ndviStatus: result.ndviStatus,
              data: result.ndvi
            });
          },
          error: (err) => {
            console.error(`Failed to load NDVI data for ${area.name}:`, err);
            this.areaVegetationData.set(area.id, {
              isLoading: false,
              ndviStatus: undefined,
              data: []
            });
          }
        });
    });
  }

  selectArea(area: EarthAreaWithClimate) {
    console.log(`🎯 User selected: ${area.name}`);
    this.areaSelected.emit(area);
  }

  goBackToEarth() {
    console.log('🌍 Going back to Earth view');
    this.backToEarth.emit();
  }

  getNDVIStatus(areaId: number): NDVIStatus | undefined {
    return this.areaVegetationData.get(areaId)?.ndviStatus;
  }

  isLoadingNDVI(areaId: number): boolean {
    return this.areaVegetationData.get(areaId)?.isLoading || false;
  }

  getVegetationHealthIcon(ndviStatus?: NDVIStatus): string {
    if (!ndviStatus) return '❓';
    
    switch (ndviStatus.color) {
      case 'red': return '🔴';
      case 'green': return '🟢';
      case 'gray': return '⚫';
      default: return '❓';
    }
  }

  getVegetationHealthText(ndviStatus?: NDVIStatus): string {
    if (!ndviStatus) return 'Loading...';
    return ndviStatus.description;
  }
}
