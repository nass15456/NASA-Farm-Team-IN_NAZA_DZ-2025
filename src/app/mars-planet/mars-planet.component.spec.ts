import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarsPlanetComponent } from './mars-planet.component';

describe('MarsPlanetComponent', () => {
  let component: MarsPlanetComponent;
  let fixture: ComponentFixture<MarsPlanetComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MarsPlanetComponent]
    });
    fixture = TestBed.createComponent(MarsPlanetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
