import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AdminControlService } from './../AdminControlService/admin-control.service';
import { AuthService } from '../core/services/auth.service';

export interface DocumentSamplePreset {
  type: string;
  label: string;
  url: string;
}

@Component({
  selector: 'app-verification-upload',
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
  templateUrl: './verification-upload.component.html',
  styleUrls: ['./verification-upload.component.scss']
})
export class VerificationUploadComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  public authService = inject(AuthService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);
  private redirectTimer: any = null;

  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  fileName = signal<string | null>(null);

  documentTypes: string[] = [
    'National ID (Fayda)',
    'Kebele ID',
    'Government Issued Passport',
    'Driver License',
    'Commercial Trade & Business License',
    'Certificate of Competence'
  ];

  sampleDocuments: DocumentSamplePreset[] = [
    {
      type: 'National ID (Fayda)',
      label: '🪪 National ID',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
    },
    {
      type: 'Government Issued Passport',
      label: '📘 Passport',
      url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80'
    },
    {
      type: 'Commercial Trade & Business License',
      label: '📄 Trade License',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
    }
  ];

  verificationForm = this.fb.group({
    documentType: ['National ID (Fayda)', Validators.required],
    documentUrl: ['']
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  goToDashboard(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.router.navigate(['/service-selection']);
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
      this.fileName.set(file.name);
      this.uploadError.set(null);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          this.previewUrl.set(res);
          this.verificationForm.patchValue({ documentUrl: res });
        };
        reader.readAsDataURL(file);
      } else {
        // PDF or other document
        this.previewUrl.set(null);
        this.verificationForm.patchValue({ documentUrl: file.name });
      }
    }
  }

  applyPreset(preset: DocumentSamplePreset): void {
    this.selectedFile.set(null);
    this.fileName.set(null);
    this.previewUrl.set(preset.url);
    this.verificationForm.patchValue({
      documentType: preset.type,
      documentUrl: preset.url
    });
  }

  onSubmit(): void {
    const docType = this.verificationForm.get('documentType')?.value || 'National ID (Fayda)';
    const docUrl = this.verificationForm.get('documentUrl')?.value;
    const file = this.selectedFile();

    if (!file && !docUrl) {
      this.uploadError.set('Please select an ID card image / PDF or pick a sample preset.');
      return;
    }

    this.submitting.set(true);
    this.uploadSuccess.set(false);
    this.uploadError.set(null);

    const onComplete = () => {
      this.submitting.set(false);
      this.uploadSuccess.set(true);
      this.selectedFile.set(null);
      this.fileName.set(null);
      this.previewUrl.set(null);
      this.verificationForm.reset({ documentType: 'National ID (Fayda)', documentUrl: '' });

      // 🚀 Auto redirect to Service Activation Studio upon completion of verification!
      this.redirectTimer = setTimeout(() => {
        this.router.navigate(['/service-selection']);
      }, 1600);
    };

    if (file) {
      // Use multipart/form-data endpoint
      this.adminService.uploadVerificationWithDocument(docType, file).subscribe({
        next: () => {
          onComplete();
        },
        error: (err) => {
          this.submitting.set(false);
          this.uploadError.set(
            err?.error?.message || err?.error?.Message || 'Verification upload failed. Please check your network & token.'
          );
        }
      });
    } else {
      // Use JSON/URL endpoint
      const currentUserId = this.authService.currentUser()?.id;
      const payload: any = {
        documentType: docType,
        documentUrl: docUrl
      };
      if (currentUserId) {
        payload.userId = currentUserId;
      }

      this.adminService.uploadVerification(payload).subscribe({
        next: () => {
          onComplete();
        },
        error: (err) => {
          this.submitting.set(false);
          this.uploadError.set(
            err?.error?.message || err?.error?.Message || 'Verification upload failed. Please check your authentication.'
          );
        }
      });
    }
  }
}
