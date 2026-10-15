import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  ProDashboardService,
  ProPayment
} from '../services/pro-dashboard.service';
import { JobService, ProJob } from '../services/job.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { ChatService, ChatMessage, ChatSession } from '../services/chat.service';
import { MapModalComponent } from '../components/map-modal/map-modal.component';

@Component({
  selector: 'app-jobs',
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
    MatProgressSpinnerModule,
    MapModalComponent
  ],
  templateUrl: './jobs.component.html',
  styleUrls: ['./jobs.component.scss']
})
export class JobsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  public jobService = inject(JobService);
  public proService = inject(ProDashboardService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  public chatService = inject(ChatService);

  // Loading and State Signals
  isLoading = signal<boolean>(true);
  actionLoading = signal<string | null>(null);
  feedbackMessage = signal<string | null>(null);

  // Professional Identity
  currentProId = signal<string>('');
  currentProName = signal<string>('Professional Specialist');

  // Server-side Pagination & Filter State
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);
  totalPages = signal<number>(1);
  searchQuery = signal<string>('');
  statusFilter = signal<'all' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'>('all');
  sortBy = signal<'scheduledDate' | 'price_desc' | 'price_asc'>('scheduledDate');

  // Loaded Items for the current page
  jobs = signal<ProJob[]>([]);
  allJobsForMetrics = signal<ProJob[]>([]);
  payments = signal<ProPayment[]>([]);

  // Selected Job for Dossier Modal
  selectedJobForInspection = signal<ProJob | null>(null);

  // In-Page Chat State
  isChatModalOpen = signal<boolean>(false);
  selectedChatJob = signal<ProJob | null>(null);
  selectedSession = signal<ChatSession | null>(null);
  chatInputText = signal<string>('');
  chatSearchQuery = signal<string>('');

  // Unread chat count badge
  unreadChatCount = computed(() => {
    return this.chatService.sessions().reduce((sum, s) => sum + (s.unreadCount || 0), 0);
  });

  // Filtered chat sessions for left sidebar
  filteredChatSessions = computed(() => {
    const list = this.chatService.sessions();
    const q = this.chatSearchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.customerName && s.customerName.toLowerCase().includes(q)) ||
        (s.lastMessage && s.lastMessage.toLowerCase().includes(q))
    );
  });

  // Map Modal State
  mapModalOpen = signal<boolean>(false);
  mapLat = signal<number>(9.0105);
  mapLng = signal<number>(38.7612);
  mapTitle = signal<string>('Job Location');
  mapSubtitle = signal<string>('Customer service site');

  // Computed Metrics from all jobs summary
  metrics = computed(() => {
    const list = this.allJobsForMetrics();
    const assignedCount = list.filter((j) => j.status === 'Assigned').length;
    const inProgressCount = list.filter((j) => j.status === 'InProgress').length;
    const completedCount = list.filter((j) => j.status === 'CompletedPendingApproval').length;
    const closedCount = list.filter((j) => j.status === 'Closed').length;
    const cancelledCount = list.filter((j) => j.status === 'Cancelled').length;
    const totalGross = list.reduce((sum, j) => sum + (j.price || 0), 0);
    const totalNet = totalGross * 0.85;

    return {
      total: list.length,
      assigned: assignedCount,
      inProgress: inProgressCount,
      completed: completedCount,
      closed: closedCount,
      cancelled: cancelledCount,
      totalGross,
      totalNet
    };
  });

  // Item range text: "Showing 1 - 10 of 42 jobs"
  rangeText = computed(() => {
    const total = this.totalCount();
    if (total === 0) return '0 jobs found';
    const start = (this.currentPage() - 1) * this.pageSize() + 1;
    const end = Math.min(this.currentPage() * this.pageSize(), total);
    return `Showing ${start} - ${end} of ${total} jobs`;
  });

  ngOnInit(): void {
    this.initProfessionalAndLoadJobs();
  }

  initProfessionalAndLoadJobs(): void {
    // 1. Role-Based Access Control: Strictly block non-professionals
    if (!this.authService.hasRole('Professional') && !this.authService.hasRole('Admin')) {
      this.router.navigate(['/unauthorized']);
      return;
    }

    this.isLoading.set(true);
    const authUser = this.authService.currentUser();
    const defaultId = authUser?.id || '';

    // Check query params or resolve via professional profile
    this.route.queryParamMap.subscribe((params) => {
      const queryId = params.get('proId') || params.get('professionalId') || params.get('id');

      if (queryId) {
        this.currentProId.set(queryId);
        if (authUser?.firstName) {
          this.currentProName.set(`${authUser.firstName} ${authUser.lastName || ''}`.trim());
        }
        this.loadJobsForPro(queryId, 1);
        this.loadMetricsSummary(queryId);
      } else {
        // Resolve professional profile ID dynamically
        this.proService.getMyProfile().subscribe({
          next: (profile) => {
            const resolvedId = profile?.id || defaultId;
            this.currentProId.set(resolvedId);
            if (profile?.fullName || profile?.businessName) {
              this.currentProName.set(profile.fullName || profile.businessName);
            } else if (authUser?.firstName) {
              this.currentProName.set(`${authUser.firstName} ${authUser.lastName || ''}`.trim());
            }
            this.loadJobsForPro(resolvedId, 1);
            this.loadMetricsSummary(resolvedId);
          },
          error: () => {
            this.currentProId.set(defaultId);
            if (authUser?.firstName) {
              this.currentProName.set(`${authUser.firstName} ${authUser.lastName || ''}`.trim());
            }
            this.loadJobsForPro(defaultId, 1);
            this.loadMetricsSummary(defaultId);
          }
        });
      }
    });
  }

  /**
   * Fetch paginated & filtered jobs from the backend API
   */
  loadJobsForPro(proId: string, page: number = 1): void {
    if (!proId) {
      this.isLoading.set(false);
      this.jobs.set([]);
      return;
    }

    this.isLoading.set(true);
    const sort = this.sortBy();
    let orderBy = 'scheduledDate';
    let descending = true;

    if (sort === 'price_desc') {
      orderBy = 'price_desc';
      descending = true;
    } else if (sort === 'price_asc') {
      orderBy = 'price_asc';
      descending = false;
    }

    this.jobService.getAssignedJobsPaged(proId, {
      page: page,
      pageSize: this.pageSize(),
      search: this.searchQuery()?.trim() || undefined,
      status: this.statusFilter(),
      orderBy: orderBy,
      descending: descending
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.jobs.set(res.items);
        this.totalCount.set(res.totalCount);
        this.totalPages.set(res.totalPages);
        this.currentPage.set(res.page);
      },
      error: (err) => {
        console.warn('JobService error fetching assigned jobs:', err);
        this.isLoading.set(false);
        this.jobs.set([]);
      }
    });

    this.proService.getPaymentsLedger(proId).subscribe({
      next: (ledger) => {
        if (ledger && ledger.length > 0) this.payments.set(ledger);
      },
      error: () => {}
    });

    this.chatService.loadMySessions().subscribe();
    this.notificationService.loadNotifications();
  }

  /**
   * Load overall job list to compute real-time metric counters
   */
  loadMetricsSummary(proId: string): void {
    this.jobService.getAssignedJobs(proId).subscribe({
      next: (all) => {
        this.allJobsForMetrics.set(all || []);
      },
      error: () => {}
    });
  }

  // ==========================================
  // FILTER & PAGINATION HANDLERS
  // ==========================================

  setStatusFilter(status: 'all' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'): void {
    this.statusFilter.set(status);
    this.loadJobsForPro(this.currentProId(), 1);
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  onSearchSubmit(): void {
    this.loadJobsForPro(this.currentProId(), 1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.loadJobsForPro(this.currentProId(), 1);
  }

  onSortChange(newSort: 'scheduledDate' | 'price_desc' | 'price_asc'): void {
    this.sortBy.set(newSort);
    this.loadJobsForPro(this.currentProId(), 1);
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.loadJobsForPro(this.currentProId(), 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.loadJobsForPro(this.currentProId(), page);
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

  // ==========================================
  // JOB LIFECYCLE WORKFLOW ACTIONS
  // ==========================================

  startJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.actionLoading.set(job.id);

    this.jobService.startJob(job.id).subscribe({
      next: () => this.finishStartJob(job),
      error: (err) => {
        console.error('JobService startJob error:', err);
        this.actionLoading.set(null);
        this.feedbackMessage.set(`Failed to start job: ${err?.message || 'Server error'}`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  private finishStartJob(job: ProJob): void {
    this.actionLoading.set(null);
    this.jobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, status: 'InProgress' } : j))
    );

    if (this.selectedJobForInspection()?.id === job.id) {
      this.selectedJobForInspection.update((prev) => (prev ? { ...prev, status: 'InProgress' } : null));
    }

    this.notificationService.updateJobNotificationStage(
      job.id,
      3,
      'Job In Progress',
      `You started work on "${job.serviceName}". Customer has been notified.`
    );
    this.feedbackMessage.set(`Job "${job.serviceName}" is now In Progress.`);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
    this.loadMetricsSummary(this.currentProId());
  }

  completeJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.actionLoading.set(job.id);

    this.jobService.completeJob(job.id).subscribe({
      next: () => this.finishCompleteJob(job),
      error: (err) => {
        console.error('JobService completeJob error:', err);
        this.actionLoading.set(null);
        this.feedbackMessage.set(`Failed to mark complete: ${err?.message || 'Server error'}`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  private finishCompleteJob(job: ProJob): void {
    this.actionLoading.set(null);
    this.jobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, status: 'CompletedPendingApproval' } : j))
    );

    if (this.selectedJobForInspection()?.id === job.id) {
      this.selectedJobForInspection.update((prev) => (prev ? { ...prev, status: 'CompletedPendingApproval' } : null));
    }

    this.notificationService.updateJobNotificationStage(
      job.id,
      4,
      'Job Completed - Pending Approval',
      `Work order for "${job.serviceName}" has been submitted for customer verification and payment release.`
    );
    this.feedbackMessage.set(`Job "${job.serviceName}" submitted for customer approval.`);
    setTimeout(() => this.feedbackMessage.set(null), 4500);
    this.loadMetricsSummary(this.currentProId());
  }

  cancelJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm(`Are you sure you want to decline or cancel the job assignment for "${job.serviceName}"? The customer will be notified immediately.`)) {
      return;
    }

    this.actionLoading.set(job.id);
    this.jobService.cancelJob(job.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.jobs.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: 'Cancelled' as any } : j))
        );
        if (this.selectedJobForInspection()?.id === job.id) {
          this.selectedJobForInspection.update((prev) => (prev ? { ...prev, status: 'Cancelled' as any } : null));
        }
        this.notificationService.updateJobNotificationStage(
          job.id,
          1,
          'Job Declined / Cancelled',
          `You declined assignment for "${job.serviceName}". Customer has been notified.`
        );
        this.feedbackMessage.set(`Job assignment for "${job.serviceName}" cancelled.`);
        setTimeout(() => this.feedbackMessage.set(null), 4500);
        this.loadMetricsSummary(this.currentProId());
      },
      error: (err) => {
        this.actionLoading.set(null);
        console.error('Cancel job error:', err);
        this.feedbackMessage.set(`Failed to cancel job assignment: ${err?.message || 'Server error'}`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  deleteJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm(`Remove "${job.serviceName}" from your jobs list?`)) {
      return;
    }

    this.actionLoading.set(job.id);
    this.jobService.deleteJob(job.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.jobs.update((list) => list.filter((j) => j.id !== job.id));
        this.feedbackMessage.set(`Job record removed.`);
        setTimeout(() => this.feedbackMessage.set(null), 3000);
        this.loadJobsForPro(this.currentProId(), this.currentPage());
        this.loadMetricsSummary(this.currentProId());
      },
      error: (err) => {
        this.actionLoading.set(null);
        console.error('Delete job error:', err);
        this.feedbackMessage.set(`Failed to remove job record: ${err?.message || 'Server error'}`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  // ==========================================
  // IN-PAGE LIVE CHAT SYSTEM
  // ==========================================

  openChatForJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedChatJob.set(job);
    this.isChatModalOpen.set(true);

    const proId = this.currentProId();
    const existing = this.chatService.sessions().find(
      (s) =>
        (job.customerId && s.customerId === job.customerId) ||
        (job.customerName && s.customerName?.trim().toLowerCase() === job.customerName.trim().toLowerCase())
    );

    if (existing) {
      this.selectedSession.set(existing);
      this.chatService.selectSession(existing.id);
    } else {
      this.chatService.getOrCreateSession(proId, job.customerId || undefined).subscribe({
        next: (res) => {
          const sId = res?.sessionId || res?.id;
          if (sId) {
            const newSess: ChatSession = {
              id: sId,
              customerId: job.customerId || '',
              customerName: job.customerName || 'Customer',
              professionalId: proId,
              professionalName: this.currentProName()
            };
            this.selectedSession.set(newSess);
            this.chatService.selectSession(sId);
          }
        },
        error: (err) => {
          console.error('Failed to create or retrieve chat session:', err);
        }
      });
    }
  }

  openDirectChatHub(): void {
    this.selectedChatJob.set(null);
    this.isChatModalOpen.set(true);
    this.chatService.loadMySessions().subscribe();
    if (!this.selectedSession() && this.chatService.sessions().length > 0) {
      this.selectChatSession(this.chatService.sessions()[0]);
    }
  }

  closeChatModal(): void {
    this.isChatModalOpen.set(false);
  }

  selectChatSession(session: ChatSession): void {
    this.selectedSession.set(session);
    this.chatService.selectSession(session.id);
  }

  onChatTyping(): void {
    this.chatService.sendTyping(true);
  }

  sendChatMessage(customText?: string): void {
    const text = (customText || this.chatInputText()).trim();
    if (!text) return;

    const session = this.selectedSession();
    const activeSessionId = session?.id || this.chatService.activeSessionId();
    if (!activeSessionId) return;

    const receiverId = session?.customerId || this.selectedChatJob()?.customerId || undefined;
    const authUser = this.authService.currentUser();

    this.chatService.sendMessage(text, activeSessionId, receiverId).subscribe({
      next: () => {
        this.chatInputText.set('');
        this.chatService.sendTyping(false);
      },
      error: (err) => {
        console.error('Chat send error:', err);
        this.chatService.sendTyping(false);
        this.feedbackMessage.set(`Failed to send message: ${err?.error?.message || err?.message || 'Network error'}`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  isMyMessage(msg: any): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return msg.senderRole === 'Professional' || msg.senderId === currentUserId || msg.senderId === this.currentProId();
  }

  formatMsgTime(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  formatAvatarUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `http://localhost:5189${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // ==========================================
  // NAVIGATION & MODALS
  // ==========================================

  openJobDossier(job: ProJob): void {
    this.selectedJobForInspection.set(job);
  }

  closeJobDossier(): void {
    this.selectedJobForInspection.set(null);
  }

  openMapLocation(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    const lat = job.latitude && !isNaN(Number(job.latitude)) ? Number(job.latitude) : 9.0105;
    const lng = job.longitude && !isNaN(Number(job.longitude)) ? Number(job.longitude) : 38.7612;
    this.mapLat.set(lat);
    this.mapLng.set(lng);
    this.mapTitle.set(`Site Location: ${job.serviceName}`);
    this.mapSubtitle.set(job.address || job.locationName || 'Addis Ababa Service Location');
    this.mapModalOpen.set(true);
  }

  closeMapModal(): void {
    this.mapModalOpen.set(false);
  }

  copyJobId(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      this.feedbackMessage.set(`Job ID copied to clipboard: ${id}`);
      setTimeout(() => this.feedbackMessage.set(null), 3000);
    });
  }
}
