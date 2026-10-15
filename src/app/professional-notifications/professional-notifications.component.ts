import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
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
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-professional-notifications',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
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
  templateUrl: './professional-notifications.component.html',
  styleUrls: ['./professional-notifications.component.scss']
})
export class ProfessionalNotificationsComponent implements OnInit {
  public notificationService = inject(NotificationService);
  private jobService = inject(JobService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  // Pagination & Filter Signals
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);
  totalPages = signal<number>(1);
  loading = signal<boolean>(false);
  searchQuery = signal<string>('');
  activeFilter = signal<'all' | 'unread'>('all');

  // Loaded Items for the current page
  pagedItems = signal<NotificationItem[]>([]);

  // Action status signals
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

  // Client-side Filtered view of current page items
  displayedNotifications = computed(() => {
    const list = this.pagedItems();
    const filter = this.activeFilter();

    if (filter === 'unread') {
      return list.filter((n) => !n.isRead);
    }
    return list;
  });

  // Range text: "Showing 1 - 10 of 42 notifications"
  rangeText = computed(() => {
    const total = this.totalCount();
    if (total === 0) return '0 notifications';
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(this.currentPage() * this.pageSize(), total);
    return `Showing ${start} - ${end} of ${total} notifications`;
  });

  ngOnInit(): void {
    this.notificationService.loadNotifications();
    this.loadPagedNotifications(1);
  }

  loadPagedNotifications(page: number = 1): void {
    this.loading.set(true);
    this.actionError.set(null);

    const statusParam = this.activeFilter() === 'unread' ? 'unread' : undefined;

    this.notificationService.getNotificationsPaged({
      page: page,
      pageSize: this.pageSize(),
      search: this.searchQuery()?.trim() || undefined,
      status: statusParam
    }).subscribe({
      next: (res) => {
        this.pagedItems.set(res.items);
        this.totalCount.set(res.totalCount);
        this.totalPages.set(res.totalPages);
        this.currentPage.set(res.page);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching paged notifications:', err);
        this.loading.set(false);
        this.actionError.set('Could not load notifications from server.');
      }
    });
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.activeFilter.set(filter);
    this.loadPagedNotifications(1);
  }

  onSearchChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  onSearchSubmit(): void {
    this.loadPagedNotifications(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.loadPagedNotifications(1);
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.loadPagedNotifications(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.loadPagedNotifications(page);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  /**
   * Helper to generate visible page numbers around current page
   */
  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + 4);

    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
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
        this.notificationService.loadNotifications();
        this.loadPagedNotifications(this.currentPage());
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.actionError.set(err?.error?.message || 'Could not start job on server.');
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
        this.notificationService.loadNotifications();
        this.loadPagedNotifications(this.currentPage());
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.actionError.set(err?.error?.message || 'Could not complete job on server.');
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
      const currentUserId = this.authService.currentUser()?.id || '';
      const dto = {
        reviewId: reviewId,
        replierId: val.replierId || currentUserId,
        comment: val.comment?.trim() || ''
      };

      this.jobService.replyToReview(dto).subscribe({
        next: () => {
          this.replySuccess.set('Reply submitted successfully!');
          this.closeReply();
          this.notificationService.loadNotifications();
          this.loadPagedNotifications(this.currentPage());
        },
        error: (err) => {
          this.actionError.set(err?.error?.message || 'Failed to submit review reply.');
        }
      });
    }
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
    this.pagedItems.update((items) =>
      items.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
    this.pagedItems.update((items) =>
      items.map((n) => ({ ...n, isRead: true }))
    );
    this.loadPagedNotifications(this.currentPage());
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id);
    this.loadPagedNotifications(this.currentPage());
  }

  clearAll(): void {
    this.notificationService.clearAll();
    this.pagedItems.set([]);
    this.totalCount.set(0);
    this.totalPages.set(1);
    this.currentPage.set(1);
  }
}
