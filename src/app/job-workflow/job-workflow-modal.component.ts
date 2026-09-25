import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { WorkflowJobData } from './job-workflow.types';
import { JobStep1BookingComponent } from './job-step1-booking.component';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-job-workflow-modal',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    JobStep1BookingComponent
  ],
  templateUrl: './job-workflow-modal.component.html',
  styleUrls: ['./job-workflow-modal.component.scss']
})
export class JobWorkflowModalComponent implements OnInit {
  private authService = inject(AuthService);

  @Input({ required: true }) initialService!: any;
  @Output() closeModal = new EventEmitter<void>();

  isCompleted = signal(false);

  jobData = signal<WorkflowJobData>({
    serviceName: 'Professional Home Service',
    price: 120,
    customerId: '',
    customerName: ''
  });

  ngOnInit(): void {
    const user = this.authService.currentUser();
    const custId = user?.id || '';
    const custName = (user?.firstName || user?.lastName)
      ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
      : 'Valued Customer';

    if (this.initialService) {
      this.jobData.set({
        serviceId: this.initialService.serviceId || this.initialService.id || '',
        serviceName: this.initialService.serviceName || this.initialService.name || 'Professional Service',
        categoryName: this.initialService.categoryName || 'Home Service',
        price: this.initialService.price || this.initialService.hourlyRate || this.initialService.effectivePrice || 100,
        pricingType: this.initialService.pricingType === 1 ? 'Hourly Rate' : 'Fixed Price',
        professionalProfileId: this.initialService.professionalProfileId || this.initialService.id || '',
        professionalName: this.initialService.professionalName || 'Verified Professional',
        professionalAvatar: this.initialService.professionalAvatarUrl || this.initialService.profilePhotoUrl || this.initialService.avatarUrl || '',
        customerId: custId,
        customerName: custName
      });
    }
  }

  onStep1Done(data: WorkflowJobData): void {
    this.jobData.set(data);
    this.isCompleted.set(true);
  }

  onClose(): void {
    this.closeModal.emit();
  }
}
