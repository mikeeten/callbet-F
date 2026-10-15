import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProfessionalService } from '../ProfessionalService/professional-profile.service';
import { AuthService } from '../app/core/services/auth.service';

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
export class ProfessionalProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfessionalService);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitting = signal(false);
  createdSuccess = signal(false);
  createdProfileId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  proDisplayName = computed(() => {
    const auth = this.authService.currentUser();
    if (auth?.firstName || auth?.lastName) {
      return `${auth.firstName || ''} ${auth.lastName || ''}`.trim();
    }
    return 'Professional Specialist';
  });

  profileForm = this.fb.group({
    headline: [
      '',
      [
        Validators.required,
        Validators.maxLength(70),
        Validators.pattern(/^[^0-9]*$/)
      ]
    ],
    bio: [
      '',
      [
        Validators.required,
        Validators.maxLength(200)
      ]
    ],
    yearsOfExperience: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(59),
        Validators.pattern(/^[0-9]+$/)
      ]
    ],
    serviceRadiusKm: [
      2.0,
      [
        Validators.required,
        Validators.min(0.1)
      ]
    ]
  });

  ngOnInit(): void {
    this.profileService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.profileForm.patchValue({
            headline: profile.headline || '',
            bio: profile.bio || '',
            yearsOfExperience: profile.yearsOfExperience || 0,
            serviceRadiusKm: profile.serviceRadiusKm ? Number(profile.serviceRadiusKm) : 2.0
          });
          if (profile.id) {
            this.createdProfileId.set(profile.id);
          }
        }
      },
      error: () => {}
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.submitting.set(true);
      this.createdSuccess.set(false);
      this.errorMessage.set(null);

      const val = this.profileForm.value;
      const payload = {
        headline: val.headline?.trim(),
        bio: val.bio?.trim(),
        yearsOfExperience: Number(val.yearsOfExperience),
        serviceRadiusKm: Number(val.serviceRadiusKm)
      };

      this.profileService.createProfile(payload).subscribe({
        next: (response: any) => {
          this.submitting.set(false);
          this.createdSuccess.set(true);
          const profileId = response?.id || response?.profileId || 'pro-saved';
          this.createdProfileId.set(profileId);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(
            err?.error?.message || 'Profile creation failed. Please check your inputs and authentication.'
          );
        }
      });
    } else {
      this.profileForm.markAllAsTouched();
    }
  }
}
