import { Component, OnInit, inject, signal } from '@angular/core';
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
export class CertificateUploadComponent implements OnInit {
  private fb = inject(FormBuilder);
  private professionalService = inject(ProfessionalService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);


  selectedFile = signal<File | null>(null);

  certificateForm = this.fb.group({
    title: [
      '',
      [
        Validators.required,
        Validators.maxLength(70),
        Validators.pattern(/^[^0-9]*$/)
      ]
    ],
    organization: [
      '',
      [
        Validators.required,
        Validators.maxLength(70),
        Validators.pattern(/^[^0-9]*$/)
      ]
    ],
    issueDate: ['', Validators.required],
    expiryDate: [''],
    documentImageUrl: ['', Validators.required]
  });

  ngOnInit(): void {}

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
      };

      if (file) {
        this.professionalService.addCertificateWithDocument(
          formValue.title?.trim()!,
          formValue.organization?.trim()!,
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
          title: formValue.title?.trim(),
          organization: formValue.organization?.trim(),
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
    } else {
      this.certificateForm.markAllAsTouched();
    }
  }
}
