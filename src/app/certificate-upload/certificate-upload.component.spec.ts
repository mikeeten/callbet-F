import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateUploadComponent } from './certificate-upload.component';

describe('CertificateUploadComponent', () => {
  let component: CertificateUploadComponent;
  let fixture: ComponentFixture<CertificateUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateUploadComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateUploadComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
