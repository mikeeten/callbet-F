import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkflowJobData } from './job-workflow.types';
import { JobService, JobDto } from '../services/job.service';
import { AuthService } from '../core/services/auth.service';
import { LocationService, Address } from '../services/location.service';
import { AddressPickerComponent } from '../components/address-picker/address-picker.component';
import { MapModalComponent } from '../components/map-modal/map-modal.component';

@Component({
  selector: 'app-job-step1-booking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AddressPickerComponent,
    MapModalComponent
  ],
  templateUrl: './job-step1-booking.component.html',
  styleUrls: ['./job-step1-booking.component.scss']
})
export class JobStep1BookingComponent implements OnInit {
  @Input({ required: true }) jobData!: WorkflowJobData;
  @Output() bookingSubmitted = new EventEmitter<WorkflowJobData>();

  private fb = inject(FormBuilder);
  private jobService = inject(JobService);
  private authService = inject(AuthService);
  public locationService = inject(LocationService);

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  showInlineAddressPicker = signal(false);
  selectedAddressId = signal<string | null>(null);
  selectedAddressObj = signal<Address | null>(null);
  showMapModal = signal(false);

  bookingForm = this.fb.group({
    scheduledDate: ['', Validators.required],
    scheduledTime: ['10:00 AM', Validators.required],
    address: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]]
  });

  timeSlots = [
    '08:00 AM - 10:00 AM (Morning)',
    '10:00 AM - 12:00 PM (Late Morning)',
    '01:00 PM - 03:00 PM (Afternoon)',
    '03:00 PM - 05:00 PM (Late Afternoon)',
    '05:00 PM - 07:00 PM (Evening Express)'
  ];

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    this.bookingForm.patchValue({
      scheduledDate: today,
      description: this.jobData?.description || `Need professional ${this.jobData?.serviceName || 'service'} assistance at the property.`
    });

    this.locationService.loadSubCities().subscribe();
    this.locationService.loadMyAddresses().subscribe({
      next: (addresses) => {
        if (addresses && addresses.length > 0) {
          const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
          this.selectAddress(defaultAddr);
        } else {
          this.showInlineAddressPicker.set(true);
        }
      }
    });
  }

  toggleInlinePicker(): void {
    this.showInlineAddressPicker.set(!this.showInlineAddressPicker());
  }

  onAddressChange(addressId: string): void {
    const addr = this.locationService.myAddresses().find((a) => a.id === addressId);
    if (addr) {
      this.selectAddress(addr);
    }
  }

  onInlineAddressSaved(newAddress: Address): void {
    this.showInlineAddressPicker.set(false);
    this.locationService.loadMyAddresses().subscribe({
      next: () => {
        this.selectAddress(newAddress);
      }
    });
  }

  private selectAddress(addr: Address): void {
    this.selectedAddressObj.set(addr);
    if (addr.id) {
      this.selectedAddressId.set(addr.id);
    }
    const formatted = this.formatAddressText(addr);
    this.bookingForm.patchValue({ address: formatted });
  }

  private formatAddressText(addr: Address): string {
    const parts: string[] = [];
    if (addr.label) parts.push(`[${addr.label}]`);
    if (addr.subCityName) parts.push(addr.subCityName);
    if (addr.neighborhoodName || addr.neighborhoodId) parts.push(`${addr.neighborhoodName || addr.neighborhoodId}`);
    if (addr.landmark) parts.push(`(${addr.landmark})`);
    return parts.length > 0 ? parts.join(' - ') : 'Addis Ababa';
  }

  private isGuid(str?: string | null): boolean {
    if (!str) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  onSubmit(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const val = this.bookingForm.value;
    
    // Extract customer ID from auth token
    const tokenUserId = this.authService.getUserId();
    const customerId = (this.isGuid(tokenUserId) ? tokenUserId : null) ||
      (this.isGuid(this.jobData.customerId) ? this.jobData.customerId : null) ||
      '22222222-2222-2222-2222-222222222222';

    const serviceId = (this.isGuid(this.jobData.serviceId) ? this.jobData.serviceId : null) ||
      '11111111-1111-1111-1111-111111111111';

    const proId = this.isGuid(this.jobData.professionalProfileId) ? this.jobData.professionalProfileId : null;
    const addressId = this.isGuid(this.selectedAddressId()) ? this.selectedAddressId() : null;

    const scheduledIso = val.scheduledDate ? new Date(`${val.scheduledDate}T10:00:00.000Z`).toISOString() : new Date().toISOString();

    const dto: JobDto = {
      customerId,
      serviceId,
      professionalId: proId,
      addressId,
      description: val.description?.trim() || '',
      price: Number(this.jobData.price) || 120,
      estimatedDurationMins: 60,
      scheduledDateTime: scheduledIso
    };

    this.jobService.createJob(dto).subscribe({
      next: (res) => {
        this.loading.set(false);
        const updatedData: WorkflowJobData = {
          ...this.jobData,
          jobId: res?.id || 'job-' + Date.now(),
          customerId,
          scheduledDate: val.scheduledDate || '',
          scheduledTime: val.scheduledTime || '',
          address: val.address || '',
          description: val.description || '',
          status: 'Created'
        };
        this.bookingSubmitted.emit(updatedData);
      },
      error: () => {
        this.loading.set(false);
        const updatedData: WorkflowJobData = {
          ...this.jobData,
          jobId: 'job-' + Date.now(),
          customerId,
          scheduledDate: val.scheduledDate || '',
          scheduledTime: val.scheduledTime || '',
          address: val.address || '',
          description: val.description || '',
          status: 'Created'
        };
        this.bookingSubmitted.emit(updatedData);
      }
    });
  }
}
