import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { EarthAreaWithClimate } from '../climate-data.service';

@Component({
  selector: 'app-area-selection',
  templateUrl: './area-selection.component.html',
  styleUrls: ['./area-selection.component.scss']
})
export class AreaSelectionComponent implements OnInit {
  @Input() availableAreas: EarthAreaWithClimate[] = [];
  @Output() areaSelected = new EventEmitter<EarthAreaWithClimate>();
  @Output() backToEarth = new EventEmitter<void>();
  
  constructor() {}

  ngOnInit() {
    // Areas are now passed from parent component via Input
    console.log(`🌍 Area selection loaded with ${this.availableAreas.length} areas`);
  }

  selectArea(area: EarthAreaWithClimate) {
    console.log(`🎯 User selected: ${area.name}`);
    this.areaSelected.emit(area);
  }

  goBackToEarth() {
    console.log('🌍 Going back to Earth view');
    this.backToEarth.emit();
  }
}
