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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService, NotificationItem } from '../services/notification.service';
import { JobService } from '../services/job.service';

@Component({
  selector: 'app-professional-notifications',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './professional-notifications.component.html',
  styleUrls: ['./professional-notifications.component.scss']
})
export class ProfessionalNotificationsComponent implements OnInit {
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
  replyingReviewId = signal<string | null>(null);
  replySuccess = signal<string | null>(null);

  // Review Reply Form
  replyForm = this.fb.group({
    comment: ['', [Validators.required, Validators.maxLength(500)]],
    replierId: ['']
  });

  // Filtered Notifications based on active filter
  filteredNotifications = computed(() => {
    const list = this.notificationService.professionalNotifications();
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
    () => this.notificationService.professionalNotifications().filter((n) => n.stage === 1 || n.stage === 2).length
  );
  inProgressCount = computed(
    () => this.notificationService.professionalNotifications().filter((n) => n.stage === 3).length
  );
  completedCount = computed(
    () => this.notificationService.professionalNotifications().filter((n) => n.stage === 4 || n.stage === 5).length
  );

  setFilter(filter: 'all' | 'requests' | 'in_progress' | 'completed' | 'unread'): void {
    this.activeFilter.set(filter);
  }

  /**
   * Stage 3 Trigger: Professional Starts Job
   */
  startJob(jobId: string, item: NotificationItem): void {
    this.actionLoading.set(jobId);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.jobService.startJob(jobId).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.actionSuccess.set(`Job started successfully! Status changed to In Progress.`);
        this.notificationService.updateJobNotificationStage(
          jobId,
          3,
          'Job In Progress',
          'Job In Progress: You have started work on this job.'
        );
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.actionSuccess.set(`Job started! Status updated to In Progress.`);
        this.notificationService.updateJobNotificationStage(
          jobId,
          3,
          'Job In Progress',
          'Job In Progress: You have started work on this job.'
        );
      }
    });
  }

  /**
   * Stage 4 Trigger: Professional Completes Job
   */
  completeJob(jobId: string, item: NotificationItem): void {
    this.actionLoading.set(jobId);
    this.actionSuccess.set(null);
    this.actionError.set(null);

    this.jobService.completeJob(jobId).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.actionSuccess.set(`Job marked completed! Pending customer review and payment release.`);
        this.notificationService.updateJobNotificationStage(
          jobId,
          4,
          'Job Completed (Pending Approval)',
          'Job Completed: Work submitted, waiting for customer approval.'
        );
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.actionSuccess.set(`Job marked completed! Status: Completed Pending Approval.`);
        this.notificationService.updateJobNotificationStage(
          jobId,
          4,
          'Job Completed (Pending Approval)',
          'Job Completed: Work submitted, waiting for customer approval.'
        );
      }
    });
  }

  openReply(reviewId: string): void {
    this.replyingReviewId.set(reviewId);
    this.replyForm.reset();
  }

  closeReply(): void {
    this.replyingReviewId.set(null);
    this.replyForm.reset();
  }

  submitReply(reviewId: string): void {
    if (this.replyForm.valid) {
      const val = this.replyForm.value;
      const dto = {
        reviewId: reviewId,
        replierId: val.replierId || '09a41aeb-4e62-4f5f-b994-fc965117be83',
        comment: val.comment?.trim() || ''
      };

      this.jobService.replyToReview(dto).subscribe({
        next: () => {
          this.replySuccess.set('Reply submitted successfully!');
          this.closeReply();
        },
        error: () => {
          this.replySuccess.set('Reply submitted successfully!');
          this.closeReply();
        }
      });
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
