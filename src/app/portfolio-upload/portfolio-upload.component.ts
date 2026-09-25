import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProfessionalService } from '../../ProfessionalService/professional-profile.service';

export interface PortfolioPreset {
  title: string;
  category: string;
  description: string;
  imageUrl: string;
}

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
export class PortfolioUploadComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private professionalService = inject(ProfessionalService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);
  private redirectTimer: any = null;

  // Sample work photo presets
  sampleProjects: PortfolioPreset[] = [
    {
      title: 'Modern Bathroom & Sanitary Renovation',
      category: 'Plumbing & Fittings',
      description: 'Replaced concealed copper piping, installed thermostatic shower mixer, and completed ceramic waterproofing.',
      imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'Complete Villa Deep Cleaning & Steam Wash',
      category: 'Home Cleaning',
      description: 'Full sanitization of 4 bedrooms, steam treatment of 3 fabric sofas, and tile grout deep restoration before tenant move-in.',
      imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'Smart Home Breaker Panel & Inverter Hub',
      category: 'Electrical & Wiring',
      description: 'Upgraded main distribution board, installed surge protection device and wired 5kVA backup solar inverter.',
      imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80'
    },
    {
      title: 'Interior Velvet Wall Texture & Waterproofing',
      category: 'Painting & Walls',
      description: 'Applied 3 coats of eco-friendly moisture resistant paint with designer accent finish on living room feature wall.',
      imageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop&q=80'
    }
  ];

  selectedFile = signal<File | null>(null);

  portfolioForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    imageUrl: ['', Validators.required],
    dateCompleted: ['', Validators.required]
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  continueToVerification(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.router.navigate(['/verification-upload']);
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
        this.portfolioForm.patchValue({
          imageUrl: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  }

  applyPreset(preset: PortfolioPreset): void {
    this.selectedFile.set(null);
    this.portfolioForm.patchValue({
      title: preset.title,
      description: preset.description,
      imageUrl: preset.imageUrl,
      dateCompleted: '2024-05-20'
    });
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
        // 🚀 Auto redirect to Step 5: Verification Upload
        this.redirectTimer = setTimeout(() => {
          this.router.navigate(['/verification-upload']);
        }, 1400);
      };

      if (file) {
        this.professionalService.addPortfolioItemWithImage(
          formValue.title!,
          formValue.description!,
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
          title: formValue.title,
          description: formValue.description,
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
    }
  }
}
