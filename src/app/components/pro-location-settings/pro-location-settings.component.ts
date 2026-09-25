import { Component, inject, OnInit, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProDashboardService } from '../../services/pro-dashboard.service';
import { LocationService, Neighborhood, SubCity, Address } from '../../services/location.service';

@Component({
  selector: 'app-pro-location-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatProgressSpinnerModule
  ],
  template: `
    <mat-card appearance="outlined" class="pro-location-card">
      <mat-card-header class="header-between">
        <div>
          <mat-card-title>Base Location & Service Area</mat-card-title>
          <mat-card-subtitle>Set your home/workshop base and define how far you travel for client jobs</mat-card-subtitle>
        </div>
        <button
          type="button"
          mat-stroked-button
          color="primary"
          class="gps-btn"
          (click)="captureGpsLocation()"
          [disabled]="isCapturingGps()"
        >
          @if (isCapturingGps()) {
            <mat-spinner diameter="16"></mat-spinner>
            <span>Locating...</span>
          } @else {
            <ng-container>
              <mat-icon>my_location</mat-icon>
              <span>Use My GPS</span>
            </ng-container>
          }
        </button>
      </mat-card-header>

      <mat-card-content>
        <!-- Service Radius Slider Section -->
        <div class="radius-control-card">
          <div class="radius-header">
            <div class="radius-title">
              <mat-icon>social_distance</mat-icon>
              <strong>Service Travel Radius</strong>
            </div>
            <span class="radius-chip">{{ serviceRadiusKm() }} km Radius</span>
          </div>

          <div class="slider-container">
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.1"
              [value]="serviceRadiusKm()"
              (input)="onRadiusChange($event)"
              class="custom-radius-slider"
            />
          </div>

          <div class="radius-markers">
            <span [class.active-zone]="serviceRadiusKm() <= 1.2">1.0 km (Immediate)</span>
            <span [class.active-zone]="serviceRadiusKm() > 1.2 && serviceRadiusKm() <= 1.8">1.5 km (Local)</span>
            <span [class.active-zone]="serviceRadiusKm() > 1.8 && serviceRadiusKm() <= 2.2">2.0 km (Ward)</span>
            <span [class.active-zone]="serviceRadiusKm() > 2.2">2.5 km (Max Radius)</span>
          </div>
        </div>

        <!-- GPS Coordinates & Embedded Map Preview -->
        @if (latitude() !== null && longitude() !== null) {
          <div class="gps-preview-box">
            <div class="gps-bar">
              <div class="gps-meta">
                <mat-icon>gps_fixed</mat-icon>
                <span>Base Coordinates: <strong>{{ latitude()?.toFixed(5) }}, {{ longitude()?.toFixed(5) }}</strong></span>
              </div>
              <div class="gps-actions">
                <a
                  [href]="googleMapsRedirectUrl()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="maps-ext-link"
                  title="Open in Google Maps in new tab"
                >
                  <mat-icon>open_in_new</mat-icon>
                  <span>Google Maps ↗</span>
                </a>
                <button type="button" class="clear-btn" (click)="clearGps()" title="Clear GPS coordinates">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            @if (safeMapPreviewUrl()) {
              <div class="map-iframe-wrapper">
                <iframe
                  [src]="safeMapPreviewUrl()"
                  class="embedded-map"
                  loading="lazy"
                  allowfullscreen
                  referrerpolicy="no-referrer-when-downgrade"
                  title="Base Location Preview"
                ></iframe>
              </div>
            }
          </div>
        }

        <!-- Base Address Form -->
        <form [formGroup]="locationForm" (ngSubmit)="saveSettings()" class="location-form">
          <div class="form-row">
            <!-- Sub-City -->
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Base Sub-City (Kifle Ketema) *</mat-label>
              <mat-select formControlName="subCityId" (selectionChange)="onSubCityChange($event.value)">
                <mat-option [value]="null" disabled>Select Sub-City</mat-option>
                @for (subCity of locationService.subCities(); track subCity.id) {
                  <mat-option [value]="subCity.id">{{ subCity.name }}</mat-option>
                }
              </mat-select>
              <mat-icon matPrefix>location_city</mat-icon>
              @if (locationForm.get('subCityId')?.hasError('required') && locationForm.get('subCityId')?.touched) {
                <mat-error>Sub-City is required</mat-error>
              }
            </mat-form-field>

            <!-- Neighborhood -->
            <mat-form-field appearance="outline" class="form-col">
              <mat-label>Base Neighborhood (Sefere / Woreda) *</mat-label>
              <mat-select
                formControlName="neighborhoodId"
                [disabled]="!selectedSubCityId() || availableNeighborhoods().length === 0"
              >
                <mat-option [value]="null" disabled>
                  {{ selectedSubCityId() ? 'Select Neighborhood' : 'Choose Sub-City First' }}
                </mat-option>
                @for (nh of availableNeighborhoods(); track nh.id) {
                  <mat-option [value]="nh.id">{{ nh.name }}</mat-option>
                }
              </mat-select>
              <mat-icon matPrefix>holiday_village</mat-icon>
              @if (locationForm.get('neighborhoodId')?.hasError('required') && locationForm.get('neighborhoodId')?.touched) {
                <mat-error>Neighborhood is required</mat-error>
              }
            </mat-form-field>
          </div>

          <!-- Landmark & Directions -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Workshop / Home Landmark & Specific Directions</mat-label>
            <input
              matInput
              formControlName="landmark"
              placeholder="e.g. Near Edna Mall, opposite Kaldis Coffee, Gate #4"
            />
            <mat-icon matPrefix>signpost</mat-icon>
          </mat-form-field>

          <!-- Contact Phone -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contact Phone Number *</mat-label>
            <input
              matInput
              formControlName="primaryPhone"
              placeholder="+251 91 123 4567 or 0911234567"
            />
            <mat-icon matPrefix>phone</mat-icon>
            @if (locationForm.get('primaryPhone')?.hasError('required') && locationForm.get('primaryPhone')?.touched) {
              <mat-error>Phone number is required</mat-error>
            }
          </mat-form-field>

          @if (successMessage()) {
            <div class="feedback-toast success">
              <mat-icon>check_circle</mat-icon>
              <span>{{ successMessage() }}</span>
            </div>
          }

          <div class="actions-row">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="save-btn"
              [disabled]="locationForm.invalid || isSaving()"
            >
              @if (isSaving()) {
                <mat-spinner diameter="18"></mat-spinner>
                <span>Saving Changes...</span>
              } @else {
                <ng-container>
                  <mat-icon>save</mat-icon>
                  <span>Save Location & Radius</span>
                </ng-container>
              }
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .pro-location-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 1.5rem;
    }

    .header-between {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      flex-wrap: wrap;
      gap: 0.75rem;

      .gps-btn {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
        border-radius: 8px;
      }
    }

    .radius-control-card {
      background: #f8faff;
      border: 1px solid #dbeafe;
      border-radius: 12px;
      padding: 1.25rem;
      margin: 1rem 0;

      .radius-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;

        .radius-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #1e293b;
          font-size: 0.95rem;

          mat-icon {
            color: #4f46e5;
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }

        .radius-chip {
          background: #4f46e5;
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
        }
      }

      .slider-container {
        padding: 0.5rem 0;

        .custom-radius-slider {
          width: 100%;
          height: 6px;
          border-radius: 4px;
          background: #cbd5e1;
          outline: none;
          accent-color: #4f46e5;
          cursor: pointer;
        }
      }

      .radius-markers {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 0.25rem;

        span.active-zone {
          color: #4f46e5;
          font-weight: 700;
        }
      }
    }

    .gps-preview-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      .gps-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #166534;
        font-size: 0.82rem;
        flex-wrap: wrap;
        gap: 0.5rem;

        .gps-meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            color: #15803d;
          }
        }

        .gps-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;

          .maps-ext-link {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 0.78rem;
            font-weight: 600;
            color: #1d4ed8;
            background: #dbeafe;
            padding: 3px 8px;
            border-radius: 6px;
            text-decoration: none;
            transition: background 0.15s;

            &:hover {
              background: #bfdbfe;
            }

            mat-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }
          }

          .clear-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            color: #9ca3af;
            display: flex;
            align-items: center;
            padding: 2px;
            border-radius: 4px;

            &:hover {
              color: #ef4444;
              background: #fee2e2;
            }

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
            }
          }
        }
      }

      .map-iframe-wrapper {
        width: 100%;
        height: 180px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #86efac;

        .embedded-map {
          width: 100%;
          height: 100%;
          border: 0;
          display: block;
        }
      }
    }

    .location-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .form-row {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;

        .form-col {
          flex: 1;
          min-width: 220px;
        }
      }

      .full-width {
        width: 100%;
      }
    }

    .feedback-toast {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.75rem;

      &.success {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #059669;
        }
      }
    }

    .actions-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.5rem;

      .save-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        border-radius: 8px;
      }
    }
  `]
})
export class ProLocationSettingsComponent implements OnInit {
  private proService = inject(ProDashboardService);
  public locationService = inject(LocationService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  saved = output<void>();

  serviceRadiusKm = signal<number>(2.5);
  selectedSubCityId = signal<number | null>(null);
  availableNeighborhoods = signal<Neighborhood[]>([]);
  latitude = signal<number | null>(null);
  longitude = signal<number | null>(null);
  isCapturingGps = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  successMessage = signal<string | null>(null);

  safeMapPreviewUrl = computed<SafeResourceUrl | null>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat !== null && lng !== null) {
      const url = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=16&output=embed`;
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return null;
  });

  googleMapsRedirectUrl = computed<string>(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    if (lat !== null && lng !== null) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    return 'https://maps.google.com';
  });

  locationForm = this.fb.group({
    subCityId: [null as number | null, Validators.required],
    neighborhoodId: [null as number | null, Validators.required],
    landmark: [''],
    primaryPhone: ['', Validators.required]
  });

  ngOnInit(): void {
    this.locationService.loadSubCities().subscribe();
    this.loadProfileLocation();
  }

  loadProfileLocation(): void {
    this.proService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile) {
          if (profile.serviceRadiusKm) {
            const clamped = Math.min(2.5, Math.max(1, profile.serviceRadiusKm));
            this.serviceRadiusKm.set(clamped);
          } else {
            this.serviceRadiusKm.set(2.5);
          }
          if (profile.baseAddress) {
            const addr = profile.baseAddress;
            this.selectedSubCityId.set(addr.subCityId || null);
            this.locationForm.patchValue({
              subCityId: addr.subCityId || null,
              neighborhoodId: addr.neighborhoodId || null,
              landmark: addr.landmark || '',
              primaryPhone: addr.primaryPhone || profile.phone || ''
            });
            if (addr.latitude) this.latitude.set(addr.latitude);
            if (addr.longitude) this.longitude.set(addr.longitude);

            if (addr.subCityId) {
              this.onSubCityChange(addr.subCityId);
              this.locationForm.patchValue({ neighborhoodId: addr.neighborhoodId });
            }
          }
        }
      },
      error: (err) => {
        console.warn('Could not load professional profile location:', err);
      }
    });
  }

  onRadiusChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const val = Math.min(2.5, Math.max(1, Number(target.value)));
    this.serviceRadiusKm.set(Number(val.toFixed(1)));
  }

  onSubCityChange(subCityId: number | null): void {
    this.selectedSubCityId.set(subCityId);
    this.locationForm.patchValue({ neighborhoodId: null });

    if (!subCityId) {
      this.availableNeighborhoods.set([]);
      return;
    }

    const subCity = this.locationService.subCities().find((s) => s.id === subCityId);
    if (subCity && subCity.neighborhoods && subCity.neighborhoods.length > 0) {
      this.availableNeighborhoods.set(subCity.neighborhoods);
    } else {
      this.locationService.getNeighborhoodsBySubCity(subCityId).subscribe({
        next: (nh) => this.availableNeighborhoods.set(nh || []),
        error: () => this.availableNeighborhoods.set([])
      });
    }
  }

  async captureGpsLocation(): Promise<void> {
    try {
      this.isCapturingGps.set(true);
      const coords = await this.locationService.getCurrentLocation();
      this.latitude.set(coords.latitude);
      this.longitude.set(coords.longitude);
    } catch (err: any) {
      alert(err.message || 'Could not fetch device GPS coordinates. Please ensure location permissions are enabled.');
    } finally {
      this.isCapturingGps.set(false);
    }
  }

  clearGps(): void {
    this.latitude.set(null);
    this.longitude.set(null);
  }

  saveSettings(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.successMessage.set(null);

    const val = this.locationForm.value;
    const subCityObj = this.locationService.subCities().find((s) => s.id === val.subCityId);
    const nhObj = this.availableNeighborhoods().find((n) => n.id === val.neighborhoodId);

    const addressPayload: Partial<Address> = {
      neighborhoodId: Number(val.neighborhoodId),
      subCityId: Number(val.subCityId),
      subCityName: subCityObj?.name || '',
      neighborhoodName: nhObj?.name || '',
      label: 'Base Workshop',
      landmark: val.landmark?.trim() || '',
      primaryPhone: val.primaryPhone?.trim() || '',
      latitude: this.latitude() ?? undefined,
      longitude: this.longitude() ?? undefined
    };

    // 1. Save Base Address
    this.proService.saveBaseAddress(addressPayload).subscribe({
      next: () => {
        // 2. Save Service Radius & Profile Settings
        this.proService.updateProfile({
          serviceRadiusKm: this.serviceRadiusKm()
        }).subscribe({
          next: () => {
            this.isSaving.set(false);
            this.successMessage.set('Base location and service radius updated successfully!');
            this.saved.emit();
            setTimeout(() => this.successMessage.set(null), 4000);
          },
          error: (err) => {
            this.isSaving.set(false);
            this.successMessage.set('Base location updated successfully!');
            this.saved.emit();
            setTimeout(() => this.successMessage.set(null), 4000);
          }
        });
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error saving base address:', err);
      }
    });
  }
}
