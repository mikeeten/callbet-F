import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResumeUploadComponent } from './resume-upload.component';

describe('ResumeUploadComponent', () => {
  let component: ResumeUploadComponent;
  let fixture: ComponentFixture<ResumeUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumeUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumeUploadComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
