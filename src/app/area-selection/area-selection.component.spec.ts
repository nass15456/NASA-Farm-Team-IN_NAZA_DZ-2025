import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AreaSelectionComponent } from './area-selection.component';

describe('AreaSelectionComponent', () => {
  let component: AreaSelectionComponent;
  let fixture: ComponentFixture<AreaSelectionComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AreaSelectionComponent]
    });
    fixture = TestBed.createComponent(AreaSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
