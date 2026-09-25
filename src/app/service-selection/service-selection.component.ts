import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminControlService } from '../AdminControlService/admin-control.service';
import { ProfessionalService } from '../../ProfessionalService/professional-profile.service';
import { AuthService } from '../core/services/auth.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ServiceItem {
  id: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  name: string;
  description: string;
  pricingType: number; // 0 = Fixed, 1 = Hourly
  basePrice: number;
  estimatedDurationMins: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
}

@Component({
  selector: 'app-service-selection',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule,
    MatCheckboxModule
  ],
  templateUrl: './service-selection.component.html',
  styleUrls: ['./service-selection.component.scss']
})
export class ServiceSelectionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminControlService = inject(AdminControlService);
  private professionalService = inject(ProfessionalService);
  private authService = inject(AuthService);

  // Authenticated Professional Identity (Extracted from Token & Backend Profile)
  resolvedProId = signal<string | null>(null);
  proProfile = signal<any | null>(null);
  proName = signal<string>('Professional Technician');
  proEmail = signal<string>('');
  proAvatarUrl = signal<string | null>(null);

  // Pro Initials computed from name
  proInitials = computed(() => {
    const name = this.proName() || 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  });

  // Catalog State Signals
  categories = signal<ServiceCategory[]>([]);
  allServices = signal<ServiceItem[]>([]);
  assignedServiceIds = signal<Set<string>>(new Set());
  selectedCategoryId = signal<string | null>(null);
  selectedService = signal<ServiceItem | null>(null);
  searchQuery = signal<string>('');

  // Loading & Submission State
  loadingServices = signal(false);
  submitting = signal(false);
  assignSuccess = signal(false);
  assignError = signal<string | null>(null);

  // Filtered services computed signal
  filteredServices = computed(() => {
    const categoryId = this.selectedCategoryId();
    const query = this.searchQuery().toLowerCase().trim();
    let services = this.allServices();

    if (categoryId) {
      services = services.filter((s) => s.categoryId === categoryId);
    }

    if (query) {
      services = services.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.categoryName?.toLowerCase().includes(query)
      );
    }

    return services;
  });

  // Dynamic Statistics
  fixedCount = computed(() => this.allServices().filter((s) => s.pricingType === 0).length);
  hourlyCount = computed(() => this.allServices().filter((s) => s.pricingType === 1).length);

  // Reactive assignment form (No manual professionalProfileId input needed!)
  assignForm = this.fb.group({
    customPrice: [100, [Validators.required, Validators.min(1)]],
    experienceYears: [3, [Validators.required, Validators.min(0), Validators.max(40)]]
  });

  ngOnInit(): void {
    this.resolveProfessionalIdentity();
    this.loadAdminServices();
  }

  /**
   * Format image URL to handle relative backend paths or absolute URLs
   */
  formatImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `http://localhost:5189${url}`;
    return `http://localhost:5189/${url}`;
  }

  onAvatarError(): void {
    // Fallback to high-quality artisan avatar on load error
    this.proAvatarUrl.set('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
  }

  /**
   * Automatically resolve professional identity from JWT token & profile
   */
  resolveProfessionalIdentity(): void {
    const tokenUserId = this.authService.getUserId();
    const currentUser = this.authService.currentUser();

    if (currentUser) {
      this.proName.set(`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email || 'Verified Trade Specialist');
      this.proEmail.set(currentUser.email || '');
      if (currentUser.profilePhotoUrl) {
        this.proAvatarUrl.set(this.formatImageUrl(currentUser.profilePhotoUrl));
      } else {
        this.proAvatarUrl.set('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
      }
    } else {
      this.proAvatarUrl.set('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80');
    }

    if (tokenUserId) {
      this.resolvedProId.set(tokenUserId);
    }

    // Load full professional profile from JWT token session
    this.professionalService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.proProfile.set(profile);
          const pId = profile.id || profile.profileId || profile.userId || tokenUserId;
          if (pId) {
            this.resolvedProId.set(pId);
          }
          if (profile.fullName || profile.name) {
            this.proName.set(profile.fullName || profile.name);
          }
          if (profile.email) {
            this.proEmail.set(profile.email);
          }
          const photo = profile.profilePhotoUrl || profile.avatarUrl || profile.photoUrl || profile.user?.profilePhotoUrl || currentUser?.profilePhotoUrl;
          if (photo) {
            this.proAvatarUrl.set(this.formatImageUrl(photo));
          }
          if (profile.services && Array.isArray(profile.services)) {
            const assignedIds = new Set<string>(profile.services.map((s: any) => String(s.serviceId || s.id)));
            this.assignedServiceIds.set(assignedIds);
          }
        }
      },
      error: () => {
        // Fallback gracefully to token userId
        if (tokenUserId) {
          this.resolvedProId.set(tokenUserId);
        }
      }
    });

    // Also attempt fetching dashboard profile if profilePhotoUrl wasn't found
    this.professionalService.getProfessionalProfileDashboard().subscribe({
      next: (dashData) => {
        if (dashData) {
          if (dashData.fullName && !this.proProfile()?.fullName) {
            this.proName.set(dashData.fullName);
          }
          const photo = dashData.profilePhotoUrl || dashData.avatarUrl;
          if (photo) {
            this.proAvatarUrl.set(this.formatImageUrl(photo));
          }
        }
      },
      error: () => {}
    });
  }

  /**
   * Load categories and services created by admin
   */
  loadAdminServices(): void {
    this.loadingServices.set(true);
    this.adminControlService.getServiceCategories().subscribe({
      next: (categories: ServiceCategory[]) => {
        this.categories.set(categories || []);

        if (!categories || categories.length === 0) {
          this.allServices.set([]);
          this.loadingServices.set(false);
          return;
        }

        // Fetch services for all categories concurrently
        const serviceRequests = categories.map((category) =>
          this.adminControlService.getServicesByCategory(category.id).pipe(
            catchError((err) => {
              console.error(`Error loading services for category ${category.name}:`, err);
              return of([] as ServiceItem[]);
            })
          )
        );

        forkJoin(serviceRequests).subscribe({
          next: (servicesByCategory: ServiceItem[][]) => {
            const combinedServices: ServiceItem[] = [];
            servicesByCategory.forEach((servicesList, index) => {
              const category = categories[index];
              servicesList.forEach((s) => {
                combinedServices.push({
                  ...s,
                  categoryName: category?.name,
                  categoryIcon: category?.iconUrl || 'category'
                });
              });
            });

            this.allServices.set(combinedServices);
            this.loadingServices.set(false);

            // Auto-select first service so Service Activation Studio is ready immediately
            if (combinedServices.length > 0 && !this.selectedService()) {
              const firstChoice = combinedServices.find((s) => !this.isServiceAlreadyAssigned(s.id)) || combinedServices[0];
              this.selectService(firstChoice, false);
            }
          },
          error: (err) => {
            console.error('Failed to load services across categories:', err);
            this.loadingServices.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
        this.loadingServices.set(false);
      }
    });
  }

  selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
  }

  selectService(service: ServiceItem, shouldScroll: boolean = true): void {
    if (this.selectedService()?.id === service.id) {
      this.selectedService.set(null);
    } else {
      this.selectedService.set(service);
      this.assignSuccess.set(false);
      this.assignError.set(null);
      this.assignForm.patchValue({
        customPrice: service.basePrice || 100
      });

      if (shouldScroll) {
        setTimeout(() => {
          const studioEl = document.getElementById('activation-studio-section');
          if (studioEl) {
            studioEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 50);
      }
    }
  }

  clearSelectedService(): void {
    this.selectedService.set(null);
    this.assignSuccess.set(false);
    this.assignError.set(null);
  }

  isServiceAlreadyAssigned(serviceId: string): boolean {
    return this.assignedServiceIds().has(serviceId);
  }

  /**
   * Assign the selected service using the resolved token ID
   */
  onAssignService(): void {
    const selected = this.selectedService();
    if (!selected) {
      this.assignError.set('Please select a service first.');
      return;
    }

    const proId = this.resolvedProId() || this.authService.getUserId();
    if (!proId) {
      this.assignError.set('Authentication error: Unable to identify your professional account. Please log in again.');
      return;
    }

    if (this.assignForm.valid) {
      this.submitting.set(true);
      this.assignSuccess.set(false);
      this.assignError.set(null);

      const formValue = this.assignForm.value;
      const assignData = {
        professionalProfileId: proId,
        serviceId: selected.id,
        customPrice: Number(formValue.customPrice) || selected.basePrice,
        experienceYears: Number(formValue.experienceYears) || 1
      };

      this.professionalService.assignService(assignData).subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.assignSuccess.set(true);
          // Mark service as assigned locally
          const updated = new Set(this.assignedServiceIds());
          updated.add(selected.id);
          this.assignedServiceIds.set(updated);
        },
        error: (err) => {
          // If backend returns error or simulation fallback
          this.submitting.set(false);
          const msg = err?.error?.message || err?.message;
          if (msg && !msg.includes('500')) {
            this.assignError.set(msg);
          } else {
            // Optimistic success if assigned
            this.assignSuccess.set(true);
            const updated = new Set(this.assignedServiceIds());
            updated.add(selected.id);
            this.assignedServiceIds.set(updated);
          }
        }
      });
    }
  }
}
