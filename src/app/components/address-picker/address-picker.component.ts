import { Component, inject, OnInit, signal, output, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LocationService, Neighborhood, SubCity, Address } from '../../services/location.service';

@Component({
  selector: 'app-address-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="address-picker-container">
      <div class="picker-header">
        <div class="header-text">
          <mat-icon class="header-icon">place</mat-icon>
          <div>
            <h4 class="title">{{ formTitle }}</h4>
            <p class="subtitle">Select sub-city, neighborhood, and GPS pin for accurate technician dispatch.</p>
          </div>
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
      </div>

      <!-- GPS Status Indicator & Map Links -->
      @if (latitude() !== null && longitude() !== null) {
        <div class="gps-card">
          <div class="gps-badge">
            <div class="gps-info">
              <mat-icon>gps_fixed</mat-icon>
              <span>GPS Pin: <strong>{{ latitude()?.toFixed(5) }}, {{ longitude()?.toFixed(5) }}</strong></span>
            </div>

            <div class="gps-actions">
              <a
                [href]="googleMapsRedirectUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="maps-redirect-link"
                title="Open in Google Maps in new tab"
              >
                <mat-icon>open_in_new</mat-icon>
                <span>Google Maps ↗</span>
              </a>

              <button
                type="button"
                class="toggle-map-btn"
                (click)="showMapPreview.set(!showMapPreview())"
                title="Toggle inline map preview"
              >
                <mat-icon>{{ showMapPreview() ? 'map' : 'explore' }}</mat-icon>
                <span>{{ showMapPreview() ? 'Hide Map' : 'Show Map' }}</span>
              </button>

              <button type="button" class="clear-gps-btn" (click)="clearGps()" title="Clear GPS Pin">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Embedded Interactive Google Map Preview -->
          @if (showMapPreview() && safeMapPreviewUrl()) {
            <div class="map-preview-wrapper">
              <iframe
                [src]="safeMapPreviewUrl()"
                class="embedded-map-iframe"
                loading="lazy"
                allowfullscreen
                referrerpolicy="no-referrer-when-downgrade"
                title="Google Map Location Preview"
              ></iframe>
            </div>
          }
        </div>
      }

      <form [formGroup]="addressForm" (ngSubmit)="saveAddress()" class="picker-form">
        <!-- SubCity & Neighborhood Cascading Row -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Sub-City (Kifle Ketema) *</mat-label>
            <mat-select formControlName="subCityId" (selectionChange)="onSubCityChange($event.value)">
              <mat-option [value]="null" disabled>Select Sub-City</mat-option>
              @for (subCity of locationService.subCities(); track subCity.id) {
                <mat-option [value]="subCity.id">{{ subCity.name }}</mat-option>
              }
            </mat-select>
            <mat-icon matPrefix>location_city</mat-icon>
            @if (addressForm.get('subCityId')?.hasError('required') && addressForm.get('subCityId')?.touched) {
              <mat-error>Sub-City is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Neighborhood (Sefere / Woreda) *</mat-label>
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
            @if (addressForm.get('neighborhoodId')?.hasError('required') && addressForm.get('neighborhoodId')?.touched) {
              <mat-error>Neighborhood is required</mat-error>
            }
          </mat-form-field>
        </div>

        <!-- Landmark / Specific Directions -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Landmark & Specific Directions (Optional)</mat-label>
          <input
            matInput
            formControlName="landmark"
            placeholder="e.g. Green gate behind bakery, Opposite Edna Mall, House #304"
          />
          <mat-icon matPrefix>signpost</mat-icon>
        </mat-form-field>

        <!-- Phone and Label Row -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Contact Phone Number *</mat-label>
            <input
              matInput
              formControlName="primaryPhone"
              placeholder="+251 91 123 4567 or 0911234567"
            />
            <mat-icon matPrefix>phone</mat-icon>
            @if (addressForm.get('primaryPhone')?.hasError('required') && addressForm.get('primaryPhone')?.touched) {
              <mat-error>Phone number is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-col">
            <mat-label>Address Label</mat-label>
            <input
              matInput
              formControlName="label"
              placeholder="e.g. Home, Office, Site, Warehouse"
            />
            <mat-icon matPrefix>label</mat-icon>
          </mat-form-field>
        </div>

        <!-- Action Buttons -->
        <div class="actions-row">
          @if (showCancel) {
            <button
              type="button"
              mat-button
              (click)="cancelClicked.emit()"
              [disabled]="isSaving()"
            >
              Cancel
            </button>
          }

          <button
            type="submit"
            mat-raised-button
            color="primary"
            class="submit-btn"
            [disabled]="addressForm.invalid || isSaving()"
          >
            @if (isSaving()) {
              <mat-spinner diameter="18"></mat-spinner>
              <span>Saving Address...</span>
            } @else {
              <ng-container>
                <mat-icon>save</mat-icon>
                <span>{{ submitButtonText }}</span>
              </ng-container>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .address-picker-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    }

    .picker-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      gap: 1rem;
      flex-wrap: wrap;

      .header-text {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .header-icon {
          color: #4f46e5;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        .title {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
        }

        .subtitle {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }

      .gps-btn {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
        border-radius: 8px;
      }
    }

    .gps-card {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 0.75rem;
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .gps-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #065f46;
      font-size: 0.82rem;
      flex-wrap: wrap;
      gap: 0.5rem;

      .gps-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #059669;
        }
      }

      .gps-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        .maps-redirect-link {
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

        .toggle-map-btn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #0f766e;
          background: #ccfbf1;
          border: none;
          padding: 3px 8px;
          border-radius: 6px;
          cursor: pointer;

          &:hover {
            background: #99f6e4;
          }

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }

        .clear-gps-btn {
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

    .map-preview-wrapper {
      width: 100%;
      height: 220px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #86efac;
      background: #e2e8f0;

      .embedded-map-iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
      }
    }

    .picker-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

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

    .actions-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;

      .submit-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        border-radius: 8px;
      }
    }
  `]
})
export class AddressPickerComponent implements OnInit {
  locationService = inject(LocationService);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);

  @Input() formTitle = 'Add Service Address';
  @Input() submitButtonText = 'Save Address';
  @Input() showCancel = false;
  @Input() defaultPhone = '';

  addressSaved = output<Address>();
  cancelClicked = output<void>();

  selectedSubCityId = signal<number | null>(null);
  availableNeighborhoods = signal<Neighborhood[]>([]);
  latitude = signal<number | null>(null);
  longitude = signal<number | null>(null);
  isCapturingGps = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  showMapPreview = signal<boolean>(true);

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

  addressForm = this.fb.group({
    subCityId: [null as number | null, Validators.required],
    neighborhoodId: [null as number | null, Validators.required],
    landmark: [''],
    primaryPhone: ['', Validators.required],
    label: ['Home']
  });

  ngOnInit(): void {
    if (this.defaultPhone) {
      this.addressForm.patchValue({ primaryPhone: this.defaultPhone });
    }

    if (this.locationService.subCities().length === 0) {
      this.locationService.loadSubCities().subscribe();
    }
  }

  onSubCityChange(subCityId: number | null): void {
    this.selectedSubCityId.set(subCityId);
    this.addressForm.patchValue({ neighborhoodId: null });

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
      this.showMapPreview.set(true);
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

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    const val = this.addressForm.value;
    const subCityObj = this.locationService.subCities().find(s => s.id === val.subCityId);
    const nhObj = this.availableNeighborhoods().find(n => n.id === val.neighborhoodId);

    const payload: Partial<Address> = {
      neighborhoodId: Number(val.neighborhoodId),
      subCityId: Number(val.subCityId),
      subCityName: subCityObj?.name || '',
      neighborhoodName: nhObj?.name || '',
      label: val.label?.trim() || 'Home',
      landmark: val.landmark?.trim() || '',
      primaryPhone: val.primaryPhone?.trim() || '',
      latitude: this.latitude() ?? undefined,
      longitude: this.longitude() ?? undefined
    };

    this.isSaving.set(true);
    this.locationService.addAddress(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        const completeAddress: Address = {
          ...payload,
          id: res?.id || 'addr-' + Date.now()
        } as Address;
        this.addressSaved.emit(completeAddress);
        this.resetForm();
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error saving address:', err);
        const fallbackAddress: Address = {
          ...payload,
          id: 'addr-' + Date.now()
        } as Address;
        this.addressSaved.emit(fallbackAddress);
        this.resetForm();
      }
    });
  }

  private resetForm(): void {
    this.addressForm.reset({
      subCityId: null,
      neighborhoodId: null,
      landmark: '',
      primaryPhone: this.defaultPhone || '',
      label: 'Home'
    });
    this.selectedSubCityId.set(null);
    this.availableNeighborhoods.set([]);
    this.latitude.set(null);
    this.longitude.set(null);
  }
}
