import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProfessionalService } from '../../ProfessionalService/professional-profile.service';

@Component({
  selector: 'app-certificate-upload',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './certificate-upload.component.html',
  styleUrls: ['./certificate-upload.component.scss']
})
export class CertificateUploadComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private professionalService = inject(ProfessionalService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);
  private redirectTimer: any = null;

  // Preset sample certificate images for quick fill
  sampleCertificates = [
    {
      title: 'Certified Master Electrician License',
      org: 'Ethiopian Energy & Electrification Authority',
      url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80'
    },
    {
      title: 'Sanitary & Hydraulic Plumbing License',
      org: 'Ministry of Urban Infrastructure & Safety',
      url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80'
    },
    {
      title: 'Professional Bio-Sanitation Certificate',
      org: 'National Health & Hygiene Standards Board',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
    }
  ];

  selectedFile = signal<File | null>(null);

  certificateForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    organization: ['', [Validators.required, Validators.maxLength(100)]],
    issueDate: ['', Validators.required],
    expiryDate: [''],
    documentImageUrl: ['', Validators.required]
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  continueToPortfolio(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.router.navigate(['/portfolio-upload']);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        this.uploadError.set('File size must not exceed 10MB.');
        return;
      }
      this.selectedFile.set(file);
      this.uploadError.set(null);

      const reader = new FileReader();
      reader.onload = () => {
        this.certificateForm.patchValue({
          documentImageUrl: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  }

  // Apply a sample preset
  applyPreset(preset: { title: string; org: string; url: string }): void {
    this.selectedFile.set(null);
    this.certificateForm.patchValue({
      title: preset.title,
      organization: preset.org,
      documentImageUrl: preset.url,
      issueDate: '2024-01-15',
      expiryDate: '2027-01-15'
    });
  }

  onSubmit(): void {
    if (this.certificateForm.valid) {
      this.submitting.set(true);
      this.uploadSuccess.set(false);
      this.uploadError.set(null);
      const formValue = this.certificateForm.value;
      const file = this.selectedFile();

      const onComplete = () => {
        this.submitting.set(false);
        this.uploadSuccess.set(true);
        this.selectedFile.set(null);
        this.certificateForm.reset();
        // 🚀 Auto redirect to Step 4: Portfolio Upload
        this.redirectTimer = setTimeout(() => {
          this.router.navigate(['/portfolio-upload']);
        }, 1400);
      };

      if (file) {
        this.professionalService.addCertificateWithDocument(
          formValue.title!,
          formValue.organization!,
          formValue.issueDate ? new Date(formValue.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          formValue.expiryDate ? new Date(formValue.expiryDate).toISOString().split('T')[0] : null,
          file
        ).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            this.submitting.set(false);
            this.uploadError.set(err?.error?.message || 'Certificate upload failed. Please check your authentication.');
          }
        });
      } else {
        const certificateData = {
          title: formValue.title,
          organization: formValue.organization,
          issueDate: formValue.issueDate ? new Date(formValue.issueDate).toISOString() : null,
          expiryDate: formValue.expiryDate ? new Date(formValue.expiryDate).toISOString() : null,
          documentImageUrl: formValue.documentImageUrl
        };

        this.professionalService.addCertificate(certificateData).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            this.submitting.set(false);
            this.uploadError.set(err?.error?.message || 'Certificate upload failed. Please check your authentication.');
          }
        });
      }
    }
  }
}