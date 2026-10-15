import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AdminControlService } from './../AdminControlService/admin-control.service';
import { AuthService } from '../core/services/auth.service';


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
export class VerificationUploadComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  public authService = inject(AuthService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);

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


  verificationForm = this.fb.group({
    documentType: ['National ID (Fayda)', Validators.required],
    documentUrl: ['']
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

  onSubmit(): void {
    const docType = this.verificationForm.get('documentType')?.value || 'National ID (Fayda)';
    const docUrl = this.verificationForm.get('documentUrl')?.value || '';
    const file = this.selectedFile();

    if (!file && !docUrl) {
      this.uploadError.set('Please select an ID card image or PDF document.');
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
