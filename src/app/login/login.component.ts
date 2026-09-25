import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormsModule,
  AbstractControl,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../core/services/auth.service';

/** Custom Cross-Field Validator for Password Confirmation Match */
export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword) return null;

  if (confirmPassword.errors && !confirmPassword.errors['passwordMismatch']) {
    return null;
  }

  if (password.value !== confirmPassword.value) {
    confirmPassword.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  } else {
    if (confirmPassword.hasError('passwordMismatch')) {
      const errors = { ...confirmPassword.errors };
      delete errors['passwordMismatch'];
      confirmPassword.setErrors(Object.keys(errors).length ? errors : null);
    }
    return null;
  }
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Active View Mode: 'login' vs 'register'
  isRegisterMode = signal<boolean>(false);
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Password Visibility Toggles
  hideLoginPassword = signal<boolean>(true);
  hideRegisterPassword = signal<boolean>(true);
  hideConfirmPassword = signal<boolean>(true);

  private returnUrl = '/';

  // Strict Regex Patterns
  readonly NAME_PATTERN = /^[a-zA-Z]+$/; // Alphabets only, no numbers, no spaces
  readonly EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  readonly PHONE_PATTERN = /^[0-9]{10}$/; // Exactly 10 digits, numbers only
  readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,32}$/;

  // Login Reactive Form
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.pattern(this.EMAIL_PATTERN)]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(32),
        Validators.pattern(this.PASSWORD_PATTERN)
      ]
    ]
  });

  // User Registration Reactive Form with Cross-Field Confirmation Match
  registerForm = this.fb.group(
    {
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
          Validators.pattern(this.NAME_PATTERN)
        ]
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
          Validators.pattern(this.NAME_PATTERN)
        ]
      ],
      role: ['Customer', Validators.required],
      email: ['', [Validators.required, Validators.pattern(this.EMAIL_PATTERN)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(this.PHONE_PATTERN)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(32),
          Validators.pattern(this.PASSWORD_PATTERN)
        ]
      ],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: passwordMatchValidator }
  );

  // Live Password Complexity Checks for Registration
  get regPasswordValue(): string {
    return this.registerForm.get('password')?.value || '';
  }

  get regConfirmPasswordValue(): string {
    return this.registerForm.get('confirmPassword')?.value || '';
  }

  get hasMinLength(): boolean {
    const val = this.regPasswordValue;
    return val.length >= 8 && val.length <= 32;
  }

  get hasUppercase(): boolean {
    return /[A-Z]/.test(this.regPasswordValue);
  }

  get hasLowercase(): boolean {
    return /[a-z]/.test(this.regPasswordValue);
  }

  get hasNumber(): boolean {
    return /\d/.test(this.regPasswordValue);
  }

  get hasSpecialChar(): boolean {
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.regPasswordValue);
  }

  get passwordsMatch(): boolean {
    const pass = this.regPasswordValue;
    const confirm = this.regConfirmPasswordValue;
    return pass.length > 0 && confirm.length > 0 && pass === confirm;
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';

    const mode = this.route.snapshot.queryParamMap.get('mode') || this.route.snapshot.queryParamMap.get('tab');
    const role = this.route.snapshot.queryParamMap.get('role');

    if (mode === 'register' || role) {
      this.isRegisterMode.set(true);
    }
    if (role === 'Professional' || role === 'Customer') {
      this.registerForm.patchValue({ role });
    }

    // If already authenticated, redirect immediately
    if (this.authService.isAuthenticated()) {
      this.navigateAfterAuth();
    }
  }

  setMode(registerMode: boolean): void {
    this.isRegisterMode.set(registerMode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  selectRole(role: 'Customer' | 'Professional'): void {
    this.registerForm.patchValue({ role });
  }

  // Sanitize name input (removes any typed spaces or non-alphabet chars)
  sanitizeNameInput(controlName: 'firstName' | 'lastName'): void {
    const control = this.registerForm.get(controlName);
    if (!control) return;
    const cleanVal = (control.value || '').replace(/[^a-zA-Z]/g, '');
    if (cleanVal !== control.value) {
      control.setValue(cleanVal);
    }
  }

  // Sanitize phone input (removes non-numeric chars)
  sanitizePhoneInput(): void {
    const control = this.registerForm.get('phoneNumber');
    if (!control) return;
    const cleanVal = (control.value || '').replace(/\D/g, '').slice(0, 10);
    if (cleanVal !== control.value) {
      control.setValue(cleanVal);
    }
  }

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.loginForm.value;
    const dto = {
      email: val.email?.trim().toLowerCase() || '',
      password: val.password || ''
    };

    this.authService.login(dto).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.navigateAfterAuth();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error || 'Invalid email or password. Please check your credentials.';
        this.errorMessage.set(typeof msg === 'string' ? msg : 'Login failed. Please verify your credentials.');
      }
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.registerForm.value;
    const dto = {
      firstName: val.firstName?.trim() || '',
      lastName: val.lastName?.trim() || '',
      email: val.email?.trim().toLowerCase() || '',
      password: val.password || '',
      role: val.role || 'Customer',
      phoneNumber: val.phoneNumber?.trim() || ''
    };

    this.authService.register(dto).subscribe({
      next: (res) => {
        // 1. If backend register already returned tokens & user is authenticated
        if (this.authService.isAuthenticated()) {
          this.loading.set(false);
          if (dto.role === 'Professional' || this.authService.currentUser()?.roles.includes('Professional')) {
            this.router.navigate(['/professional-profile']);
          } else {
            this.navigateAfterAuth();
          }
          return;
        }

        // 2. Otherwise auto-login with newly registered credentials to obtain JWT token & session
        this.authService.login({ email: dto.email, password: dto.password }).subscribe({
          next: () => {
            this.loading.set(false);
            if (dto.role === 'Professional' || this.authService.currentUser()?.roles.includes('Professional')) {
              this.router.navigate(['/professional-profile']);
            } else {
              this.navigateAfterAuth();
            }
          },
          error: () => {
            // Fallback: If auto-login fails, show success message and switch to login tab
            this.loading.set(false);
            this.successMessage.set('Account created successfully! Please sign in with your credentials.');
            this.isRegisterMode.set(false);
            this.loginForm.patchValue({ email: dto.email });
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message || err?.error || 'Registration failed. This email may already be registered.';
        this.errorMessage.set(typeof msg === 'string' ? msg : 'Registration failed. Please try again.');
      }
    });
  }

  private navigateAfterAuth(): void {
    if (this.returnUrl && this.returnUrl !== '/' && !this.returnUrl.includes('/login')) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }

    const user = this.authService.currentUser();
    if (user?.roles.includes('Admin')) {
      this.router.navigate(['/admin-dashboard']);
    } else if (user?.roles.includes('Professional')) {
      this.router.navigate(['/professional-dashboard']);
    } else {
      this.router.navigate(['/customer-dashboard']);
    }
  }
}

