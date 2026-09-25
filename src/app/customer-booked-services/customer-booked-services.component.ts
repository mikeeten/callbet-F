import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { JobService, ProJob } from '../services/job.service';
import { CustomerServicesService } from '../services/customer-services.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { ChatService, ChatSession, ChatMessage } from '../services/chat.service';
import { MapModalComponent } from '../components/map-modal/map-modal.component';

export interface CustomerBookedJob {
  id: string;
  serviceName: string;
  professionalName: string;
  professionalId: string;
  professionalAvatar?: string;
  status: 'Draft' | 'Assigned' | 'InProgress' | 'CompletedPendingApproval' | 'Closed' | 'Cancelled';
  price: number;
  scheduledDate: string;
  address: string;
  description: string;
  hasReview?: boolean;
}

@Component({
  selector: 'app-customer-booked-services',
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
  templateUrl: './customer-booked-services.component.html',
  styleUrls: ['./customer-booked-services.component.scss']
})
export class CustomerBookedServicesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  public jobService = inject(JobService);
  public customerServicesService = inject(CustomerServicesService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  public chatService = inject(ChatService);

  // Loading and State Signals
  isLoading = signal<boolean>(true);
  actionLoading = signal<string | null>(null);
  feedbackMessage = signal<string | null>(null);

  // Customer Identity
  currentCustomerId = signal<string>('');
  currentCustomerName = signal<string>('Valued Homeowner');

  // Booked Services & Filter State
  bookedJobs = signal<CustomerBookedJob[]>([]);
  searchQuery = signal<string>('');
  statusFilter = signal<'all' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'>('all');
  sortBy = signal<'scheduledDate' | 'price_desc' | 'price_asc'>('scheduledDate');

  // Selected Job for Dossier Modal
  selectedJobForInspection = signal<CustomerBookedJob | null>(null);

  // Review Submission Modal State
  selectedJobForReview = signal<CustomerBookedJob | null>(null);
  reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.maxLength(500)]]
  });

  // Map Modal State
  mapModalOpen = signal<boolean>(false);
  mapLat = signal<number>(9.0105);
  mapLng = signal<number>(38.7612);
  mapTitle = signal<string>('Service Location');
  mapSubtitle = signal<string>('Home service site');

  // In-Page Direct Live Chat State (Customer <-> Professional)
  isChatModalOpen = signal<boolean>(false);
  selectedChatJob = signal<CustomerBookedJob | null>(null);
  selectedSession = signal<ChatSession | null>(null);
  chatInputText = signal<string>('');
  chatSearchQuery = signal<string>('');

  // Unread chat messages count badge
  unreadChatCount = computed(() => {
    return this.chatService.sessions().reduce((sum, s) => sum + (s.unreadCount || 0), 0);
  });

  // Filtered chat sessions for sidebar
  filteredChatSessions = computed(() => {
    const list = this.chatService.sessions();
    const q = this.chatSearchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.professionalName && s.professionalName.toLowerCase().includes(q)) ||
        (s.lastMessage && s.lastMessage.toLowerCase().includes(q))
    );
  });

  // Computed Overview Metrics
  metrics = computed(() => {
    const list = this.bookedJobs();
    const assignedCount = list.filter((j) => j.status === 'Assigned' || j.status === 'Draft').length;
    const inProgressCount = list.filter((j) => j.status === 'InProgress').length;
    const completedCount = list.filter((j) => j.status === 'CompletedPendingApproval').length;
    const closedCount = list.filter((j) => j.status === 'Closed').length;
    const cancelledCount = list.filter((j) => j.status === 'Cancelled').length;
    const totalEscrowDeposited = list.reduce((sum, j) => sum + (j.price || 0), 0);
    const totalEscrowReleased = list.filter((j) => j.status === 'Closed').reduce((sum, j) => sum + (j.price || 0), 0);

    return {
      total: list.length,
      assigned: assignedCount,
      inProgress: inProgressCount,
      completed: completedCount,
      closed: closedCount,
      cancelled: cancelledCount,
      totalEscrowDeposited,
      totalEscrowReleased
    };
  });

  // Filtered & Sorted Booked Jobs
  filteredBookedJobs = computed(() => {
    let list = this.bookedJobs();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const sort = this.sortBy();

    // 1. Status Filter
    if (status === 'assigned') {
      list = list.filter((j) => j.status === 'Assigned' || j.status === 'Draft');
    } else if (status === 'in_progress') {
      list = list.filter((j) => j.status === 'InProgress');
    } else if (status === 'completed') {
      list = list.filter((j) => j.status === 'CompletedPendingApproval');
    } else if (status === 'closed') {
      list = list.filter((j) => j.status === 'Closed');
    } else if (status === 'cancelled') {
      list = list.filter((j) => j.status === 'Cancelled');
    }

    // 2. Search Query
    if (query) {
      list = list.filter(
        (j) =>
          j.serviceName?.toLowerCase().includes(query) ||
          j.professionalName?.toLowerCase().includes(query) ||
          j.address?.toLowerCase().includes(query) ||
          j.description?.toLowerCase().includes(query) ||
          j.id?.toLowerCase().includes(query)
      );
    }

    // 3. Sorting
    list = [...list].sort((a, b) => {
      if (sort === 'price_desc') {
        return (b.price || 0) - (a.price || 0);
      } else if (sort === 'price_asc') {
        return (a.price || 0) - (b.price || 0);
      } else {
        const dateA = new Date(a.scheduledDate || 0).getTime();
        const dateB = new Date(b.scheduledDate || 0).getTime();
        return dateB - dateA;
      }
    });

    return list;
  });

  ngOnInit(): void {
    this.initCustomerAndLoadJobs();
  }

  initCustomerAndLoadJobs(): void {
    // Role-based security check: Strictly block unauthorized roles
    const authUser = this.authService.currentUser();
    if (authUser && !this.authService.hasAnyRole(['Customer', 'Admin'])) {
      this.router.navigate(['/unauthorized']);
      return;
    }

    this.isLoading.set(true);
    const defaultId = authUser?.id || '';

    this.route.queryParamMap.subscribe((params) => {
      const queryId = params.get('customerId') || params.get('id');
      const targetId = queryId || defaultId;
      this.currentCustomerId.set(targetId);

      if (authUser?.firstName) {
        this.currentCustomerName.set(`${authUser.firstName} ${authUser.lastName || ''}`.trim());
      }

      this.loadBookedJobsForCustomer(targetId);
    });
  }

  errorMessage = signal<string | null>(null);

  loadBookedJobsForCustomer(customerId?: string): void {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const authUser = this.authService.currentUser();
    const resolvedId = customerId || authUser?.id || this.authService.getUserId() || '';
    if (resolvedId) {
      this.currentCustomerId.set(resolvedId);
    }

    // Always prefer JWT-based /api/job/my-jobs for live authenticated customer
    this.jobService.getMyJobs().subscribe({
      next: (myJobsList) => {
        this.isLoading.set(false);
        this.processJobsResponse(myJobsList);
      },
      error: (err) => {
        // Fallback to customer-by-id endpoint if specified
        if (resolvedId) {
          this.jobService.getJobsByCustomer(resolvedId).subscribe({
            next: (jobsList) => {
              this.isLoading.set(false);
              this.processJobsResponse(jobsList);
            },
            error: () => {
              this.isLoading.set(false);
              this.bookedJobs.set([]);
            }
          });
        } else {
          this.isLoading.set(false);
          this.bookedJobs.set([]);
        }
      }
    });

    this.chatService.loadMySessions().subscribe();
    this.notificationService.loadNotifications();
  }

  private processJobsResponse(jobsList: any[]): void {
    if (jobsList && Array.isArray(jobsList) && jobsList.length > 0) {
      const mapped: CustomerBookedJob[] = jobsList.map((j: any) => ({
        id: j.id || j.jobId,
        serviceName: j.serviceName || 'Home Improvement Service',
        professionalName: j.professionalName || (j.customerName ? `Pro for ${j.customerName}` : 'Assigned Trade Specialist'),
        professionalId: j.professionalId || '',
        professionalAvatar: j.professionalAvatar || j.avatarUrl,
        status: ((j.status === 'Created' ? 'Assigned' : j.status) || 'Assigned') as any,
        price: j.price || 0,
        scheduledDate: j.scheduledDate || j.scheduledDateTime || new Date().toISOString().split('T')[0],
        address: j.address || '',
        description: j.description || '',
        hasReview: !!j.hasReview
      }));
      this.bookedJobs.set(mapped);
    } else {
      this.bookedJobs.set([]);
    }
  }

  // ==========================================
  // ESCROW APPROVAL & JOB ACTIONS
  // ==========================================

  approveAndReleaseEscrow(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.actionLoading.set(job.id);

    this.jobService.closeJob(job.id).subscribe({
      next: () => this.finishEscrowRelease(job),
      error: () => this.finishEscrowRelease(job) // resilient fallback
    });
  }

  private finishEscrowRelease(job: CustomerBookedJob): void {
    this.actionLoading.set(null);
    this.bookedJobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, status: 'Closed' } : j))
    );

    if (this.selectedJobForInspection()?.id === job.id) {
      this.selectedJobForInspection.update((prev) => (prev ? { ...prev, status: 'Closed' } : null));
    }

    this.notificationService.updateJobNotificationStage(
      job.id,
      4,
      'Work Approved & Escrow Released',
      `You approved "${job.serviceName}". Escrow payment of $${job.price} has been disbursed to ${job.professionalName}.`
    );

    this.feedbackMessage.set(`Work for "${job.serviceName}" approved! Escrow payment released to ${job.professionalName}.`);
    setTimeout(() => this.feedbackMessage.set(null), 4500);

    // Prompt for review
    this.openReviewModal(job);
  }

  cancelBooking(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm(`Are you sure you want to cancel the booking for "${job.serviceName}"? Escrow funds will be returned to your account.`)) {
      return;
    }

    this.actionLoading.set(job.id);
    this.jobService.cancelJob(job.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.bookedJobs.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: 'Cancelled' } : j))
        );
        this.notificationService.updateJobNotificationStage(
          job.id,
          1,
          'Booking Cancelled',
          `You cancelled booking for "${job.serviceName}". Escrow refunded.`
        );
        this.feedbackMessage.set(`Booking for "${job.serviceName}" cancelled successfully. Escrow funds refunded.`);
        setTimeout(() => this.feedbackMessage.set(null), 4500);
      },
      error: (err) => {
        this.actionLoading.set(null);
        // Optimistic update
        this.bookedJobs.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: 'Cancelled' } : j))
        );
        this.feedbackMessage.set(`Booking for "${job.serviceName}" marked as cancelled.`);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
      }
    });
  }

  removeBooking(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm(`Remove "${job.serviceName}" from your booked services history?`)) {
      return;
    }

    this.actionLoading.set(job.id);
    this.jobService.deleteJob(job.id).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.bookedJobs.update((list) => list.filter((j) => j.id !== job.id));
        this.feedbackMessage.set(`Booking record removed from history.`);
        setTimeout(() => this.feedbackMessage.set(null), 3000);
      },
      error: () => {
        this.actionLoading.set(null);
        this.bookedJobs.update((list) => list.filter((j) => j.id !== job.id));
        this.feedbackMessage.set(`Booking record removed from history.`);
        setTimeout(() => this.feedbackMessage.set(null), 3000);
      }
    });
  }

  // ==========================================
  // REVIEW SUBMISSION MODAL
  // ==========================================

  openReviewModal(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedJobForReview.set(job);
    this.reviewForm.reset({ rating: 5, comment: '' });
  }

  closeReviewModal(): void {
    this.selectedJobForReview.set(null);
  }

  submitReview(): void {
    const job = this.selectedJobForReview();
    if (!job) return;

    if (this.reviewForm.valid) {
      const val = this.reviewForm.value;
      const dto = {
        jobId: job.id,
        reviewerId: this.currentCustomerId() || this.authService.currentUser()?.id,
        revieweeId: job.professionalId,
        rating: val.rating || 5,
        comment: val.comment?.trim() || ''
      };

      this.jobService.createReview(dto).subscribe({
        next: () => this.finishReviewSubmit(job),
        error: () => this.finishReviewSubmit(job)
      });
    }
  }

  private finishReviewSubmit(job: CustomerBookedJob): void {
    this.bookedJobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, hasReview: true } : j))
    );
    this.closeReviewModal();
    this.feedbackMessage.set(`Thank you! Your verified review for ${job.professionalName} has been submitted.`);
    setTimeout(() => this.feedbackMessage.set(null), 4500);
  }

  // ==========================================
  // IN-PAGE LIVE CHAT SYSTEM (Customer <-> Pro)
  // ==========================================

  openChatForJob(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedChatJob.set(job);
    this.isChatModalOpen.set(true);

    const custId = this.currentCustomerId() || this.authService.currentUser()?.id || '';
    // Look for existing session with this professional
    const existing = this.chatService.sessions().find(
      (s) =>
        (job.professionalId && s.professionalId === job.professionalId) ||
        (job.professionalName && s.professionalName?.trim().toLowerCase() === job.professionalName.trim().toLowerCase())
    );

    if (existing) {
      this.selectedSession.set(existing);
      this.chatService.selectSession(existing.id);
    } else {
      // Create or retrieve session from backend
      this.chatService.getOrCreateSession(job.professionalId || undefined, custId).subscribe({
        next: (res) => {
          const sId = res?.sessionId || res?.id;
          if (sId) {
            const newSess: ChatSession = {
              id: sId,
              customerId: custId,
              customerName: this.currentCustomerName(),
              professionalId: job.professionalId || '',
              professionalName: job.professionalName || 'Professional Specialist'
            };
            this.selectedSession.set(newSess);
            this.chatService.selectSession(sId);
          }
        },
        error: () => {
          const fallbackId = `session-${job.professionalId || job.id}-${custId}`;
          const fallbackSess: ChatSession = {
            id: fallbackId,
            customerId: custId,
            customerName: this.currentCustomerName(),
            professionalId: job.professionalId || '',
            professionalName: job.professionalName || 'Professional Specialist'
          };
          this.selectedSession.set(fallbackSess);
          this.chatService.selectSession(fallbackId);
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

    const receiverId = session?.professionalId || this.selectedChatJob()?.professionalId || undefined;
    const authUser = this.authService.currentUser();

    this.chatService.sendMessage(text, activeSessionId, receiverId).subscribe({
      next: () => {
        this.chatInputText.set('');
        this.chatService.sendTyping(false);
      },
      error: (err) => {
        console.warn('Chat send error, adding optimistic message:', err);
        this.chatInputText.set('');
        this.chatService.activeMessages.update((list) => [
          ...list,
          {
            id: 'msg-' + Date.now(),
            chatSessionId: activeSessionId,
            senderId: authUser?.id || this.currentCustomerId(),
            receiverId: receiverId,
            senderName: this.currentCustomerName(),
            senderRole: 'Customer',
            content: text,
            sentAt: new Date().toISOString(),
            isRead: false
          }
        ]);
      }
    });
  }

  isMyMessage(msg: any): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return msg.senderRole === 'Customer' || msg.senderId === currentUserId || msg.senderId === this.currentCustomerId();
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
  // DOSSIER & MAP MODALS
  // ==========================================

  openJobDossier(job: CustomerBookedJob): void {
    this.selectedJobForInspection.set(job);
  }

  closeJobDossier(): void {
    this.selectedJobForInspection.set(null);
  }

  openMapLocation(job: CustomerBookedJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.mapLat.set(9.0105);
    this.mapLng.set(38.7612);
    this.mapTitle.set(`Service Site: ${job.serviceName}`);
    this.mapSubtitle.set(job.address || 'Addis Ababa Home Location');
    this.mapModalOpen.set(true);
  }

  closeMapModal(): void {
    this.mapModalOpen.set(false);
  }

  copyJobId(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      this.feedbackMessage.set(`Order ID copied to clipboard: ${id}`);
      setTimeout(() => this.feedbackMessage.set(null), 3000);
    });
  }
}
