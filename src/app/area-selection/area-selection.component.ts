import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { GameDataService, EarthArea } from '../game-data.service';

@Component({
  selector: 'app-area-selection',
  templateUrl: './area-selection.component.html',
  styleUrls: ['./area-selection.component.scss']
})
export class AreaSelectionComponent implements OnInit {
  @Output() areaSelected = new EventEmitter<EarthArea>();
  
  earthAreas: EarthArea[] = [];

  constructor(private gameDataService: GameDataService) {}

  ngOnInit() {
    this.earthAreas = this.gameDataService.getEarthAreas();
  }

  selectArea(area: EarthArea) {
    this.areaSelected.emit(area);
  }
}
