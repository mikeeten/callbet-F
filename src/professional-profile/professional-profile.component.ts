import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProfessionalService } from '../ProfessionalService/professional-profile.service';

@Component({
  selector: 'app-professional-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './professional-profile.component.html',
  styleUrls: ['./professional-profile.component.scss']
})
export class ProfessionalProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfessionalService);
  private router = inject(Router);

  submitting = signal(false);
  createdSuccess = signal(false);
  createdProfileId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  private redirectTimer: any = null;

  // Sample presets for quick testing
  samplePresets = [
    {
      label: '⚡ Master Electrician',
      headline: 'Certified Master Electrician & Smart Home Specialist',
      bio: '8+ years of residential and commercial electrical installation. Specialized in circuit breaker maintenance, smart automation, and generator repair.',
      experience: 8,
      radius: 2.5
    },
    {
      label: '🧹 Deep Cleaning Specialist',
      headline: 'Eco-Friendly Deep Villa & Sofa Cleaning Expert',
      bio: '6+ years providing hospital-grade steam sanitization, upholstery stain extraction, and post-renovation cleanup with eco-friendly non-toxic agents.',
      experience: 6,
      radius: 1.5
    },
    {
      label: '🔧 Master Plumber',
      headline: 'Certified Hydraulic & Leak Detection Specialist',
      bio: '9+ years diagnosing concealed water leaks, sanitary fixture installations, water pump servicing, and bathroom remodeling.',
      experience: 9,
      radius: 2.0
    }
  ];

  profileForm = this.fb.group({
    headline: ['', [Validators.required, Validators.maxLength(100)]],
    bio: ['', [Validators.required, Validators.maxLength(500)]],
    yearsOfExperience: [0, [Validators.required, Validators.min(0)]],
    serviceRadiusKm: [2.5, [Validators.required, Validators.min(1), Validators.max(2.5)]]
  });

  ngOnInit(): void {
    this.profileService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.profileForm.patchValue({
            headline: profile.headline || '',
            bio: profile.bio || '',
            yearsOfExperience: profile.yearsOfExperience || 0,
            serviceRadiusKm: profile.serviceRadiusKm ? Math.min(2.5, Math.max(1, profile.serviceRadiusKm)) : 2.5
          });
          if (profile.id) {
            this.createdProfileId.set(profile.id);
          }
        }
      },
      error: () => {}
    });
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  applyPreset(preset: typeof this.samplePresets[0]): void {
    this.profileForm.patchValue({
      headline: preset.headline,
      bio: preset.bio,
      yearsOfExperience: preset.experience,
      serviceRadiusKm: preset.radius
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.submitting.set(true);
      this.createdSuccess.set(false);
      this.errorMessage.set(null);

      const val = this.profileForm.value;
      const payload = {
        headline: val.headline,
        bio: val.bio,
        yearsOfExperience: val.yearsOfExperience,
        serviceRadiusKm: val.serviceRadiusKm
      };

      this.profileService.createProfile(payload).subscribe({
        next: (response: any) => {
          this.submitting.set(false);
          this.createdSuccess.set(true);
          const profileId = response?.id || response?.profileId || 'pro-saved';
          this.createdProfileId.set(profileId);

          // 🚀 Automatic Redirection to Step 2: Resume Upload
          this.redirectTimer = setTimeout(() => {
            this.router.navigate(['/resume-upload']);
          }, 1400);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Profile creation failed. Please check your inputs and authentication.'
          );
        }
      });
    }
  }

  continueToResume(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.router.navigate(['/resume-upload']);
  }
}
