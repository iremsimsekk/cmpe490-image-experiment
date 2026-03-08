import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExperimentComponent } from './experiment.component';

describe('ExperimentComponent', () => {
  let component: ExperimentComponent;
  let fixture: ComponentFixture<ExperimentComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ExperimentComponent]
    });
    fixture = TestBed.createComponent(ExperimentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
