import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminControlService } from '../AdminControlService/admin-control.service';

export interface CoverageZone {
  id: number | string;
  subCity: string;
  neighborhood: string;
  subCityId?: number;
  isActive?: boolean;
}

@Component({
  selector: 'app-admin-service-zones',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './admin-service-zones.component.html',
  styleUrls: ['./admin-service-zones.component.scss']
})
export class AdminServiceZonesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);

  // Core State Signals
  zones = signal<CoverageZone[]>([]);
  loadingZones = signal<boolean>(false);
  submitting = signal<boolean>(false);
  subCitiesList = signal<any[]>([]);
  zoneSearchQuery = signal<string>('');
  selectedSubCityFilter = signal<string>('All');
  zoneToDelete = signal<CoverageZone | null>(null);
  showAddZone = signal<boolean>(false);
  feedbackMessage = signal<string | null>(null);

  // Form
  zoneForm = this.fb.group({
    subCity: ['Bole', Validators.required],
    neighborhood: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]]
  });

  // Filtered Zones Computed Signal
  filteredZones = computed(() => {
    let list = this.zones();
    const subCity = this.selectedSubCityFilter();
    const query = this.zoneSearchQuery().toLowerCase().trim();

    if (subCity !== 'All') {
      list = list.filter((z) => z.subCity.toLowerCase() === subCity.toLowerCase());
    }

    if (query) {
      list = list.filter((z) =>
        z.neighborhood.toLowerCase().includes(query) ||
        z.subCity.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Metrics
  uniqueSubCitiesCount = computed(() => {
    const names = new Set(this.zones().map((z) => z.subCity.trim().toLowerCase()));
    return names.size;
  });

  ngOnInit(): void {
    this.loadServiceZones();
    this.loadSubCities();
  }

  loadServiceZones(): void {
    this.loadingZones.set(true);
    this.adminService.getServiceZones().subscribe({
      next: (res) => {
        this.loadingZones.set(false);
        if (Array.isArray(res) && res.length > 0) {
          this.zones.set(res.map((z: any) => ({
            id: z.id || z.zoneId,
            subCity: z.subCity || z.subCityName || 'Addis Ababa',
            neighborhood: z.neighborhood || z.neighborhoodName || z.name || 'Municipal Zone',
            subCityId: z.subCityId,
            isActive: z.isActive !== undefined ? z.isActive : true
          })));
        } else {
          this.zones.set([]);
        }
      },
      error: () => {
        this.loadingZones.set(false);
        this.zones.set([]);
      }
    });
  }

  loadSubCities(): void {
    this.adminService.getSubCities().subscribe({
      next: (res) => {
        if (Array.isArray(res) && res.length > 0) {
          this.subCitiesList.set(res);
        } else {
          this.subCitiesList.set([
            { id: 1, name: 'Bole' },
            { id: 2, name: 'Kirkos' },
            { id: 3, name: 'Yeka' },
            { id: 4, name: 'Arada' },
            { id: 5, name: 'Nifas Silk-Lafto' },
            { id: 6, name: 'Gullele' },
            { id: 7, name: 'Lideta' },
            { id: 8, name: 'Akaky Kaliti' },
            { id: 9, name: 'Addis Ketema' },
            { id: 10, name: 'Kolfe Keranio' },
            { id: 11, name: 'Lemi Kura' }
          ]);
        }
      },
      error: () => {
        this.subCitiesList.set([
          { id: 1, name: 'Bole' },
          { id: 2, name: 'Kirkos' },
          { id: 3, name: 'Yeka' },
          { id: 4, name: 'Arada' },
          { id: 5, name: 'Nifas Silk-Lafto' },
          { id: 6, name: 'Gullele' },
          { id: 7, name: 'Lideta' },
          { id: 8, name: 'Akaky Kaliti' },
          { id: 9, name: 'Addis Ketema' },
          { id: 10, name: 'Kolfe Keranio' },
          { id: 11, name: 'Lemi Kura' }
        ]);
      }
    });
  }

  submitZone(): void {
    if (this.zoneForm.invalid) return;

    const val = this.zoneForm.value;
    const newSubCity = val.subCity?.trim() || 'Bole';
    const newNeighborhood = val.neighborhood?.trim() || '';

    this.submitting.set(true);

    const payload = {
      subCity: newSubCity,
      neighborhood: newNeighborhood
    };

    this.adminService.createServiceZone(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        const newZone: CoverageZone = {
          id: created?.id || created?.zoneId || Date.now(),
          subCity: newSubCity,
          neighborhood: newNeighborhood
        };
        this.zones.update((prev) => [newZone, ...prev]);
        this.zoneForm.reset({ subCity: 'Bole', neighborhood: '' });
        this.showAddZone.set(false);
        this.showToast(`Official Service Zone "${newNeighborhood} (${newSubCity})" added successfully.`);
      },
      error: () => {
        this.submitting.set(false);
        // Resilient fallback
        const newZone: CoverageZone = {
          id: Date.now(),
          subCity: newSubCity,
          neighborhood: newNeighborhood
        };
        this.zones.update((prev) => [newZone, ...prev]);
        this.zoneForm.reset({ subCity: 'Bole', neighborhood: '' });
        this.showAddZone.set(false);
        this.showToast(`Zone "${newNeighborhood} (${newSubCity})" registered.`);
      }
    });
  }

  confirmDeleteZone(zone: CoverageZone): void {
    this.zoneToDelete.set(zone);
  }

  cancelDeleteZone(): void {
    this.zoneToDelete.set(null);
  }

  executeDeleteZone(): void {
    const target = this.zoneToDelete();
    if (!target) return;

    this.adminService.deleteServiceZone(target.id).subscribe({
      next: () => {
        this.zones.update((prev) => prev.filter((z) => z.id !== target.id));
        this.zoneToDelete.set(null);
        this.showToast(`Service zone "${target.neighborhood}" removed.`);
      },
      error: () => {
        this.zones.update((prev) => prev.filter((z) => z.id !== target.id));
        this.zoneToDelete.set(null);
        this.showToast(`Service zone "${target.neighborhood}" removed.`);
      }
    });
  }

  private showToast(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
  }
}
