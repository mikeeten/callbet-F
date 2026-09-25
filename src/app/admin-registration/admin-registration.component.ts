import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, RegisterRequestDto } from '../core/services/auth.service';

@Component({
  selector: 'app-admin-registration',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './admin-registration.component.html',
  styleUrls: ['./admin-registration.component.scss']
})
export class AdminRegistrationComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  hidePassword = signal(true);

  adminForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phoneNumber: ['', [Validators.required]]
  });

  fillDemoAdmin(): void {
    this.adminForm.patchValue({
      firstName: 'Head',
      lastName: 'Admin',
      email: 'headadmin@callbet.et',
      password: 'AdminPassword123',
      phoneNumber: '+251911000000'
    });
  }

  onSubmit(): void {
    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.adminForm.value;
    const dto: RegisterRequestDto = {
      email: val.email?.trim() || '',
      password: val.password || '',
      firstName: val.firstName?.trim() || '',
      lastName: val.lastName?.trim() || '',
      phoneNumber: val.phoneNumber?.trim() || '',
      role: 'Admin'
    };

    this.authService.registerAdmin(dto).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set('System Administrator registered successfully! Redirecting to Admin Tower...');
        setTimeout(() => {
          this.router.navigate(['/admin-dashboard']);
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        const msg =
          err?.error?.message ||
          (typeof err?.error === 'string' ? err?.error : null) ||
          'Registration failed. Please check your admin credentials or network connection.';
        this.errorMessage.set(msg);
      }
    });
  }
}
