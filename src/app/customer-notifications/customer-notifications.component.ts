import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService, NotificationItem } from '../services/notification.service';
import { JobService } from '../services/job.service';

@Component({
  selector: 'app-customer-notifications',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './customer-notifications.component.html',
  styleUrls: ['./customer-notifications.component.scss']
})
export class CustomerNotificationsComponent implements OnInit {
  ngOnInit(): void {
    this.notificationService.loadNotifications();
  }

  public notificationService = inject(NotificationService);
  private jobService = inject(JobService);
  private fb = inject(FormBuilder);

  // State Signals
  activeFilter = signal<'all' | 'requests' | 'in_progress' | 'completed' | 'unread'>('all');
  actionLoading = signal<string | null>(null);
  actionSuccess = signal<string | null>(null);
  actionError = signal<string | null>(null);
  reviewingJobId = signal<string | null>(null);
  reviewSuccess = signal<string | null>(null);

  // Review Form for Homeowners
  reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.maxLength(500)]]
  });

  // Filtered Notifications based on active filter
  filteredNotifications = computed(() => {
    const list = this.notificationService.customerNotifications();
    const filter = this.activeFilter();

    if (filter === 'unread') {
      return list.filter((n) => !n.isRead);
    }
    if (filter === 'requests') {
      return list.filter((n) => n.stage === 1 || n.stage === 2);
    }
    if (filter === 'in_progress') {
      return list.filter((n) => n.stage === 3);
    }
    if (filter === 'completed') {
      return list.filter((n) => n.stage === 4 || n.stage === 5);
    }
    return list;
  });

  // Stage Count Statistics
  requestsCount = computed(
    () => this.notificationService.customerNotifications().filter((n) => n.stage === 1 || n.stage === 2).length
  );
  inProgressCount = computed(
    () => this.notificationService.customerNotifications().filter((n) => n.stage === 3).length
  );
  completedCount = computed(
    () => this.notificationService.customerNotifications().filter((n) => n.stage === 4 || n.stage === 5).length
  );

  setFilter(filter: 'all' | 'requests' | 'in_progress' | 'completed' | 'unread'): void {
    this.activeFilter.set(filter);
  }

  /**
   * Homeowner approves completed job and releases escrow payout
   */
  approveJob(jobId: string, item: NotificationItem): void {
    this.actionLoading.set(jobId);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    // Call backend release / approve
    setTimeout(() => {
      this.actionLoading.set(null);
      this.actionSuccess.set(`Job approved! Escrow payment released to your professional. Thank you!`);
      this.notificationService.updateJobNotificationStage(
        jobId,
        5,
        'Job Approved & Payment Released',
        'You have approved the work! Escrow payment was disbursed. Please rate the service.'
      );
    }, 600);
  }

  openReviewModal(jobId: string): void {
    this.reviewingJobId.set(jobId);
    this.reviewForm.reset({ rating: 5, comment: '' });
  }

  closeReviewModal(): void {
    this.reviewingJobId.set(null);
    this.reviewForm.reset({ rating: 5, comment: '' });
  }

  submitReview(jobId: string): void {
    if (this.reviewForm.valid) {
      const val = this.reviewForm.value;
      this.actionLoading.set(jobId);

      setTimeout(() => {
        this.actionLoading.set(null);
        this.reviewSuccess.set('Thank you! Your verified rating and review have been published.');
        this.closeReviewModal();
      }, 500);
    }
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id);
  }

  clearAll(): void {
    this.notificationService.clearAll();
  }
}
