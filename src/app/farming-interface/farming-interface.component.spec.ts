import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FarmingInterfaceComponent } from './farming-interface.component';

describe('FarmingInterfaceComponent', () => {
  let component: FarmingInterfaceComponent;
  let fixture: ComponentFixture<FarmingInterfaceComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FarmingInterfaceComponent]
    });
    fixture = TestBed.createComponent(FarmingInterfaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
