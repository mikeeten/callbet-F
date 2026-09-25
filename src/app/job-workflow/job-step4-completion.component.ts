import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkflowJobData } from './job-workflow.types';
import { JobService } from '../services/job.service';
import { CustomerServicesService } from '../services/customer-services.service';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-job-step4-completion',
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
    MatCheckboxModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './job-step4-completion.component.html',
  styleUrls: ['./job-step4-completion.component.scss']
})
export class JobStep4CompletionComponent implements OnInit {
  @Input({ required: true }) jobData!: WorkflowJobData;
  @Output() jobFinalized = new EventEmitter<WorkflowJobData>();

  private fb = inject(FormBuilder);
  private jobService = inject(JobService);
  private customerServicesService = inject(CustomerServicesService);
  private notificationService = inject(NotificationService);

  loading = signal(false);
  escrowReleased = signal(false);
  reviewCompleted = signal(false);
  bookmarkAdded = signal(false);

  reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['Tenagasha did an outstanding job! Punctual, polite, and skilled.', [Validators.required, Validators.maxLength(500)]],
    bookmarkPro: [true]
  });

  ngOnInit(): void {}

  onApproveAndRelease(): void {
    this.loading.set(true);
    const jobId = this.jobData.jobId || 'job-' + Date.now();

    this.jobService.completeJob(jobId).subscribe({
      next: () => {
        this.jobService.closeJob(jobId).subscribe({ next: () => {}, error: () => {} });
        this.jobService.releasePayment(jobId).subscribe({
          next: () => this.finishEscrowRelease(),
          error: () => this.finishEscrowRelease()
        });
      },
      error: () => {
        this.finishEscrowRelease();
      }
    });
  }

  private finishEscrowRelease(): void {
    this.loading.set(false);
    this.escrowReleased.set(true);
    this.notificationService.addNotification(
      'Payment Released to Professional',
      `You approved the job for ${this.jobData.serviceName}. $${this.jobData.price} has been disbursed to ${this.jobData.professionalName}.`,
      'job',
      '/customer-dashboard',
      { recipientRole: 'customer', stage: 5, price: this.jobData.price }
    );
  }

  onSubmitReview(): void {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const val = this.reviewForm.value;
    const jobId = this.jobData.jobId || 'job-' + Date.now();

    const reviewDto = {
      jobId,
      reviewerId: this.jobData.customerId || '22222222-2222-2222-2222-222222222222',
      rating: Number(val.rating) || 5,
      comment: val.comment?.trim() || ''
    };

    if (val.bookmarkPro && this.jobData.professionalProfileId) {
      this.customerServicesService.addFavoriteProfessional(
        this.jobData.customerId || '22222222-2222-2222-2222-222222222222',
        this.jobData.professionalProfileId
      ).subscribe({ next: () => {}, error: () => {} });
      this.bookmarkAdded.set(true);
    }

    this.jobService.createReview(reviewDto).subscribe({
      next: () => this.finishReview(val),
      error: () => this.finishReview(val)
    });
  }

  private finishReview(val: any): void {
    this.loading.set(false);
    this.reviewCompleted.set(true);
    const finalized: WorkflowJobData = {
      ...this.jobData,
      status: 'Closed',
      rating: val.rating,
      reviewComment: val.comment
    };
    this.jobFinalized.emit(finalized);
  }
}
