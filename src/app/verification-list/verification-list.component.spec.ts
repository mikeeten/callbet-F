import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerificationListComponent } from './verification-list.component';

describe('VerificationListComponent', () => {
  let component: VerificationListComponent;
  let fixture: ComponentFixture<VerificationListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificationListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
