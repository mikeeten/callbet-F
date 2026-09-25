import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortfolioUploadComponent } from './portfolio-upload.component';

describe('PortfolioUploadComponent', () => {
  let component: PortfolioUploadComponent;
  let fixture: ComponentFixture<PortfolioUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortfolioUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PortfolioUploadComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
