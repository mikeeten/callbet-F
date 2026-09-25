import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminControlService } from '../../app/AdminControlService/admin-control.service';
import { CustomerServicesService } from '../../app/services/customer-services.service';

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  parentCategoryId?: string;
}

export interface ServiceItem {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description: string;
  pricingType: number | string; // 0 = Fixed, 1 = Hourly
  basePrice: number;
  estimatedDurationMins: number;
  createdAt?: string;
}

@Component({
  selector: 'app-admin-services',
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
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatTabsModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './admin-services.component.html',
  styleUrls: ['./admin-services.component.scss']
})
export class AdminServicesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  private customerServicesService = inject(CustomerServicesService);

  // Active View Tab
  activeTab = signal<'catalog' | 'new-service' | 'new-category'>('catalog');

  // Categories & Services State
  categories = signal<ServiceCategory[]>([]);
  services = signal<ServiceItem[]>([]);
  loadingCategories = signal(false);
  loadingServices = signal(false);
  submittingCategory = signal(false);
  submittingService = signal(false);

  // Search & Filter State
  searchQuery = signal('');
  selectedCategoryFilter = signal('all');

  // Toast Banners
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  // Category Form
  categoryForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.maxLength(300)]],
    iconUrl: ['category'],
    parentCategoryId: ['']
  });

  // Service Form
  serviceForm = this.fb.group({
    categoryId: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    pricingType: [0, Validators.required], // 0 = Fixed, 1 = Hourly
    basePrice: [100, [Validators.required, Validators.min(1)]],
    estimatedDurationMins: [60, [Validators.required, Validators.min(15)]]
  });

  // Computed Real Dynamic Metrics
  fixedPricingCount = computed(() => this.services().filter((s) => s.pricingType === 0 || (s.pricingType as any) === 'Fixed').length);
  hourlyPricingCount = computed(() => this.services().filter((s) => s.pricingType === 1 || (s.pricingType as any) === 'Hourly').length);

  // Filtered Services List
  filteredServices = computed(() => {
    let list = this.services();
    const query = this.searchQuery().toLowerCase().trim();
    const catFilter = this.selectedCategoryFilter();

    if (catFilter !== 'all') {
      list = list.filter((s) => s.categoryId === catFilter);
    }

    if (query) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.categoryName?.toLowerCase().includes(query)
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadServices();
  }

  loadCategories(): void {
    this.loadingCategories.set(true);
    this.adminService.getServiceCategories().subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : ((data as any)?.items || []);
        this.categories.set(list);
        this.loadingCategories.set(false);
      },
      error: (err) => {
        console.error('Failed to load service categories from backend:', err);
        this.categories.set([]);
        this.loadingCategories.set(false);
      }
    });
  }

  loadServices(): void {
    this.loadingServices.set(true);
    this.customerServicesService.getProfessionalServices({ pageSize: 100 }).subscribe({
      next: (res) => {
        if (res && res.items && Array.isArray(res.items)) {
          const mapped: ServiceItem[] = res.items.map((item) => ({
            id: item.serviceId || item.id,
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            name: item.serviceName,
            description: item.serviceDescription || 'Professional service offering provided by verified technician.',
            pricingType: item.pricingType ?? 0,
            basePrice: item.basePrice || item.effectivePrice || 100,
            estimatedDurationMins: item.estimatedDurationMins || 60,
            createdAt: new Date().toISOString().split('T')[0]
          }));

          // Deduplicate by service name / id
          const uniqueMap = new Map<string, ServiceItem>();
          for (const s of mapped) {
            if (!uniqueMap.has(s.id)) {
              uniqueMap.set(s.id, s);
            }
          }
          this.services.set(Array.from(uniqueMap.values()));
        } else {
          this.services.set([]);
        }
        this.loadingServices.set(false);
      },
      error: (err) => {
        console.error('Failed to load published services from backend:', err);
        this.services.set([]);
        this.loadingServices.set(false);
      }
    });
  }

  setTab(tab: 'catalog' | 'new-service' | 'new-category'): void {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  setCategoryFilter(catId: string): void {
    this.selectedCategoryFilter.set(catId);
  }

  getCategoryName(catId: string): string {
    const found = this.categories().find((c) => c.id === catId);
    return found ? found.name : 'General Category';
  }

  onSubmitCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    this.submittingCategory.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.categoryForm.value;
    const categoryData: any = {
      name: val.name?.trim(),
      description: val.description?.trim(),
      iconUrl: val.iconUrl?.trim() || 'category'
    };

    if (val.parentCategoryId && val.parentCategoryId.trim()) {
      categoryData.parentCategoryId = val.parentCategoryId.trim();
    }

    this.adminService.createServiceCategory(categoryData).subscribe({
      next: (res) => {
        this.submittingCategory.set(false);
        this.successMessage.set(`Category "${categoryData.name}" created successfully in database!`);
        this.categoryForm.reset({ iconUrl: 'category' });
        this.loadCategories();
        setTimeout(() => this.activeTab.set('catalog'), 1200);
      },
      error: (err) => {
        this.submittingCategory.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to create service category on server.');
      }
    });
  }

  onSubmitService(): void {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }

    this.submittingService.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const val = this.serviceForm.value;
    const serviceData: any = {
      categoryId: val.categoryId,
      name: val.name?.trim(),
      description: val.description?.trim(),
      pricingType: Number(val.pricingType),
      basePrice: Number(val.basePrice),
      estimatedDurationMins: Number(val.estimatedDurationMins)
    };

    this.adminService.createService(serviceData).subscribe({
      next: (res) => {
        this.submittingService.set(false);
        const catName = this.getCategoryName(serviceData.categoryId);
        this.successMessage.set(`Service "${serviceData.name}" published successfully to catalog under ${catName}!`);
        this.serviceForm.reset({ pricingType: 0, basePrice: 100, estimatedDurationMins: 60 });
        this.loadServices();
        setTimeout(() => this.activeTab.set('catalog'), 1200);
      },
      error: (err) => {
        this.submittingService.set(false);
        this.errorMessage.set(err?.error?.message || 'Failed to publish service offering on server.');
      }
    });
  }
}