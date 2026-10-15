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
  selector: 'app-portfolio-upload',
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
  templateUrl: './portfolio-upload.component.html',
  styleUrls: ['./portfolio-upload.component.scss']
})
export class PortfolioUploadComponent implements OnInit {
  private fb = inject(FormBuilder);
  private professionalService = inject(ProfessionalService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);


  selectedFile = signal<File | null>(null);

  portfolioForm = this.fb.group({
    title: [
      '',
      [
        Validators.required,
        Validators.maxLength(70),
        Validators.pattern(/^[^0-9]*$/)
      ]
    ],
    description: [
      '',
      [
        Validators.required,
        Validators.maxLength(500)
      ]
    ],
    imageUrl: ['', Validators.required],
    dateCompleted: ['', Validators.required]
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
        this.portfolioForm.patchValue({
          imageUrl: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  }


  onSubmit(): void {
    if (this.portfolioForm.valid) {
      this.submitting.set(true);
      this.uploadSuccess.set(false);
      this.uploadError.set(null);

      const formValue = this.portfolioForm.value;
      const file = this.selectedFile();

      const onComplete = () => {
        this.submitting.set(false);
        this.uploadSuccess.set(true);
        this.selectedFile.set(null);
        this.portfolioForm.reset();
      };

      if (file) {
        this.professionalService.addPortfolioItemWithImage(
          formValue.title?.trim()!,
          formValue.description?.trim()!,
          formValue.dateCompleted ? new Date(formValue.dateCompleted).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          file
        ).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            this.submitting.set(false);
            this.uploadError.set(err?.error?.message || 'Portfolio upload failed. Please verify your authentication.');
          }
        });
      } else {
        const portfolioData = {
          title: formValue.title?.trim(),
          description: formValue.description?.trim(),
          imageUrl: formValue.imageUrl,
          dateCompleted: formValue.dateCompleted
            ? new Date(formValue.dateCompleted).toISOString()
            : null
        };

        this.professionalService.addPortfolioItem(portfolioData).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            this.submitting.set(false);
            this.uploadError.set(err?.error?.message || 'Portfolio upload failed. Please verify your authentication.');
          }
        });
      }
    } else {
      this.portfolioForm.markAllAsTouched();
    }
  }
}
