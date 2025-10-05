import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { GameDataService, EarthArea, EarthAreaExtended, Crop } from '../game-data.service';
import { LocationData } from '../climate-data.service';

@Component({
  selector: 'app-farming-interface',
  templateUrl: './farming-interface.component.html',
  styleUrls: ['./farming-interface.component.scss']
})
export class FarmingInterfaceComponent implements OnInit {
  @Input() selectedArea: EarthAreaExtended | null = null;
  @Input() currentLocationData: LocationData | null = null;
  @Output() startQuiz = new EventEmitter<void>();
  @Output() backToPlanet = new EventEmitter<void>();
  
  availableCrops: Crop[] = [];
  farmPlots: (Crop | null)[] = Array(12).fill(null);
  suitableCrops: Crop[] = [];
  draggedCrop: Crop | null = null;
  
  constructor(private gameDataService: GameDataService) {}

  ngOnInit() {
    this.availableCrops = this.gameDataService.getCrops();
    if (this.selectedArea) {
      this.suitableCrops = this.gameDataService.getSuitableCrops(this.selectedArea);
    }
  }

  onDragStart(event: DragEvent, crop: Crop) {
    this.draggedCrop = crop;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', crop.id.toString());
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onDrop(event: DragEvent, plotIndex: number) {
    event.preventDefault();
    if (this.draggedCrop) {
      this.farmPlots[plotIndex] = this.draggedCrop;
      this.draggedCrop = null;
    }
  }

  clearPlot(index: number) {
    this.farmPlots[index] = null;
  }

  isCropSuitable(crop: Crop): boolean {
    return this.suitableCrops.includes(crop);
  }

  onStartQuiz() {
    this.startQuiz.emit();
  }

  onBackToPlanet() {
    this.backToPlanet.emit();
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
