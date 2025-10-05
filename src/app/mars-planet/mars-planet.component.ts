import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-mars-planet',
  templateUrl: './mars-planet.component.html',
  styleUrls: ['./mars-planet.component.scss']
})
export class MarsPlanetComponent {
  @Input() isSpinning: boolean = false;
  @Input() isLoadingData: boolean = false;
  @Output() planetClick = new EventEmitter<void>();

  onPlanetClick() {
    if (!this.isLoadingData) {
      this.planetClick.emit();
    }
  }
}
