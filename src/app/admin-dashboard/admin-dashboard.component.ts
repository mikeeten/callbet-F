import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminControlService } from '../AdminControlService/admin-control.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { AdminReportsComponent } from '../admin-reports/admin-reports.component';

export interface FlaggedReview {
  id: string;
  jobId: string;
  reviewerName: string;
  professionalName: string;
  rating: number;
  comment: string;
  flagReason: string;
  flagDate: string;
  status: 'Flagged' | 'Dismissed' | 'Removed';
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    AdminReportsComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminControlService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);

  // Active Navigation Tab
  activeTab = signal<'moderation' | 'reports'>('reports');

  // Signout Confirmation Modal State
  showSignoutConfirm = signal(false);

  // Content Moderation State & Server-Side Filtering
  flaggedReviews = signal<FlaggedReview[]>([]);
  loadingModeration = signal<boolean>(false);
  moderationActionLoading = signal<string | null>(null);
  moderationPage = signal<number>(1);
  moderationPageSize = signal<number>(10);
  moderationTotalCount = signal<number>(0);
  moderationTotalPages = signal<number>(1);
  moderationSearchQuery = signal<string>('');
  moderationStatusFilter = signal<'all' | 'Flagged' | 'Dismissed' | 'Removed'>('all');
  private modSearchTimeout: any = null;

  // Dynamic Metrics for Moderation
  moderationFlaggedCount = computed(() => this.flaggedReviews().filter(r => r.status === 'Flagged').length);
  moderationDismissedCount = computed(() => this.flaggedReviews().filter(r => r.status === 'Dismissed').length);
  moderationRemovedCount = computed(() => this.flaggedReviews().filter(r => r.status === 'Removed').length);

  // Action Feedback
  feedbackMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Initial page load focuses on Incident & Dispute Reports.
    // Content Moderation data is lazy-loaded on-demand when the user clicks the tab.
  }

  setTab(tab: 'moderation' | 'reports'): void {
    this.activeTab.set(tab);
    this.feedbackMessage.set(null);
    if (tab === 'moderation') {
      this.loadModerationReviews();
    }
  }

  // Load Moderation Reviews with Server-Side Filtering and Pagination
  loadModerationReviews(page: number = this.moderationPage()): void {
    this.loadingModeration.set(true);
    this.moderationPage.set(page);

    const queryParams = {
      page: page,
      pageSize: this.moderationPageSize(),
      search: this.moderationSearchQuery().trim() || undefined,
      status: this.moderationStatusFilter() !== 'all' ? this.moderationStatusFilter() : undefined
    };

    this.adminService.getModerationReviews(queryParams).subscribe({
      next: (res: any) => {
        this.loadingModeration.set(false);
        if (res && res.items !== undefined && Array.isArray(res.items)) {
          const mapped: FlaggedReview[] = res.items.map((r: any) => this.mapModerationDto(r));
          this.flaggedReviews.set(mapped);
          this.moderationTotalCount.set(res.totalCount || 0);
          this.moderationPage.set(res.page || page);
          this.moderationTotalPages.set(Math.ceil((res.totalCount || 0) / this.moderationPageSize()) || 1);
        } else if (Array.isArray(res)) {
          const mapped: FlaggedReview[] = res.map((r: any) => this.mapModerationDto(r));
          this.flaggedReviews.set(mapped);
          this.moderationTotalCount.set(res.length);
          this.moderationTotalPages.set(Math.ceil(res.length / this.moderationPageSize()) || 1);
        } else {
          this.flaggedReviews.set([]);
          this.moderationTotalCount.set(0);
          this.moderationTotalPages.set(1);
        }
      },
      error: (err) => {
        console.warn('Failed to load moderation reviews from backend:', err);
        this.loadingModeration.set(false);
        this.flaggedReviews.set([]);
        this.moderationTotalCount.set(0);
        this.moderationTotalPages.set(1);
      }
    });
  }

  private mapModerationDto(r: any): FlaggedReview {
    return {
      id: r.id || r.Id,
      jobId: (r.jobId || r.JobId || '').toString().substring(0, 8),
      reviewerName: r.reviewerName || r.ReviewerName || 'Anonymous Customer',
      professionalName: r.professionalName || r.ProfessionalName || 'Assigned Specialist',
      rating: r.rating || r.Rating || 5,
      comment: r.comment || r.Comment || '',
      flagReason: r.flagReason || r.FlagReason || 'Reported for policy violation',
      flagDate: r.flagDate || r.FlagDate ? new Date(r.flagDate || r.FlagDate).toLocaleDateString() : 'Recent',
      status: (r.status || r.Status || 'Flagged') as 'Flagged' | 'Dismissed' | 'Removed'
    };
  }

  onModerationSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.moderationSearchQuery.set(target.value);

    if (this.modSearchTimeout) {
      clearTimeout(this.modSearchTimeout);
    }
    this.modSearchTimeout = setTimeout(() => {
      this.loadModerationReviews(1);
    }, 300);
  }

  setModerationStatusFilter(status: 'all' | 'Flagged' | 'Dismissed' | 'Removed'): void {
    this.moderationStatusFilter.set(status);
    this.loadModerationReviews(1);
  }

  resetModerationFilters(): void {
    this.moderationSearchQuery.set('');
    this.moderationStatusFilter.set('all');
    this.loadModerationReviews(1);
  }

  goToModerationPage(page: number): void {
    if (page >= 1 && page <= this.moderationTotalPages() && page !== this.moderationPage()) {
      this.loadModerationReviews(page);
    }
  }

  nextModerationPage(): void {
    if (this.moderationPage() < this.moderationTotalPages()) {
      this.loadModerationReviews(this.moderationPage() + 1);
    }
  }

  prevModerationPage(): void {
    if (this.moderationPage() > 1) {
      this.loadModerationReviews(this.moderationPage() - 1);
    }
  }

  // Moderation Actions with Live Backend Integration
  dismissFlag(review: FlaggedReview): void {
    this.moderationActionLoading.set(review.id);
    this.adminService.dismissReviewFlag(review.id).subscribe({
      next: () => {
        this.moderationActionLoading.set(null);
        this.flaggedReviews.update((list) =>
          list.map((r) => (r.id === review.id ? { ...r, status: 'Dismissed' } : r))
        );
        this.feedbackMessage.set('Review flag dismissed for Job #' + review.jobId + '. Review remains active.');
      },
      error: (err) => {
        console.error('Failed to dismiss review flag:', err);
        this.moderationActionLoading.set(null);
        this.feedbackMessage.set('Unable to dismiss review flag at this time. Please try again.');
      }
    });
  }

  removeReview(review: FlaggedReview): void {
    this.moderationActionLoading.set(review.id);
    this.adminService.deleteReview(review.id).subscribe({
      next: () => {
        this.moderationActionLoading.set(null);
        this.flaggedReviews.update((list) =>
          list.map((r) => (r.id === review.id ? { ...r, status: 'Removed' } : r))
        );
        this.feedbackMessage.set('Abusive review for Job #' + review.jobId + ' removed from platform and audit logged.');
      },
      error: (err) => {
        console.error('Failed to remove review:', err);
        this.moderationActionLoading.set(null);
        this.feedbackMessage.set('Unable to remove review at this time. Please try again.');
      }
    });
  }

  // Signout Confirmation Modal Actions
  openSignoutConfirm(): void {
    this.showSignoutConfirm.set(true);
  }

  closeSignoutConfirm(): void {
    this.showSignoutConfirm.set(false);
  }

  confirmSignout(): void {
    this.showSignoutConfirm.set(false);
    this.authService.logout(true);
  }
}
