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

  // Job Data & Filter State
  jobs = signal<ProJob[]>([]);
  payments = signal<ProPayment[]>([]);
  searchQuery = signal<string>('');
  statusFilter = signal<'all' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled'>('all');
  sortBy = signal<'scheduledDate' | 'price_desc' | 'price_asc'>('scheduledDate');

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

  // Computed Metrics
  metrics = computed(() => {
    const list = this.jobs();
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

  // Filtered Jobs
  filteredJobs = computed(() => {
    let list = this.jobs();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const sort = this.sortBy();

    // 1. Status Filtering
    if (status === 'assigned') {
      list = list.filter((j) => j.status === 'Assigned');
    } else if (status === 'in_progress') {
      list = list.filter((j) => j.status === 'InProgress');
    } else if (status === 'completed') {
      list = list.filter((j) => j.status === 'CompletedPendingApproval');
    } else if (status === 'closed') {
      list = list.filter((j) => j.status === 'Closed');
    } else if (status === 'cancelled') {
      list = list.filter((j) => j.status === 'Cancelled');
    }

    // 2. Query Search
    if (query) {
      list = list.filter(
        (j) =>
          j.serviceName?.toLowerCase().includes(query) ||
          j.customerName?.toLowerCase().includes(query) ||
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
        // Scheduled date or fallback to ID
        const dateA = new Date(a.scheduledDate || 0).getTime();
        const dateB = new Date(b.scheduledDate || 0).getTime();
        return dateB - dateA;
      }
    });

    return list;
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
        this.loadJobsForPro(queryId);
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
            this.loadJobsForPro(resolvedId);
          },
          error: () => {
            this.currentProId.set(defaultId);
            if (authUser?.firstName) {
              this.currentProName.set(`${authUser.firstName} ${authUser.lastName || ''}`.trim());
            }
            this.loadJobsForPro(defaultId);
          }
        });
      }
    });
  }

  loadJobsForPro(proId: string): void {
    if (!proId) {
      this.isLoading.set(false);
      this.jobs.set([]);
      return;
    }

    this.jobService.getAssignedJobs(proId).subscribe({
      next: (jobsList) => {
        this.isLoading.set(false);
        if (jobsList && jobsList.length > 0) {
          // Normalize any 'Created' or unassigned statuses to Assigned for display
          const normalized = jobsList.map((j) => ({
            ...j,
            status: ((j.status as string) === 'Created' ? 'Assigned' : j.status) as any
          }));
          this.jobs.set(normalized);
        } else {
          this.jobs.set([]);
        }
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

  // ==========================================
  // JOB LIFECYCLE WORKFLOW ACTIONS (via JobService)
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
    this.feedbackMessage.set(`Job "${job.serviceName}" is now In Progress!`);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
  }

  completeJob(job: ProJob, event?: Event): void {
    if (event) event.stopPropagation();
    this.actionLoading.set(job.id);

    this.jobService.completeJob(job.id).subscribe({
      next: () => this.finishCompleteJob(job),
      error: (err) => {
        console.error('JobService completeJob error:', err);
        this.actionLoading.set(null);
        this.feedbackMessage.set(`Failed to complete job: ${err?.message || 'Server error'}`);
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
      this.selectedJobForInspection.update((prev) =>
        prev ? { ...prev, status: 'CompletedPendingApproval' } : null
      );
    }

    this.notificationService.updateJobNotificationStage(
      job.id,
      4,
      'Job Completed (Pending Approval)',
      `Work submitted for "${job.serviceName}". Waiting for customer inspection & escrow release.`
    );
    this.feedbackMessage.set(`Job "${job.serviceName}" marked complete! Waiting for customer approval.`);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
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
      },
      error: (err) => {
        this.actionLoading.set(null);
        this.jobs.update((list) =>
          list.map((j) => (j.id === job.id ? { ...j, status: 'Cancelled' as any } : j))
        );
        this.feedbackMessage.set(`Job assignment for "${job.serviceName}" cancelled.`);
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
      },
      error: () => {
        this.actionLoading.set(null);
        this.jobs.update((list) => list.filter((j) => j.id !== job.id));
        this.feedbackMessage.set(`Job record removed.`);
        setTimeout(() => this.feedbackMessage.set(null), 3000);
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
    // Check if an existing chat session with this customer already exists
    const existing = this.chatService.sessions().find(
      (s) =>
        (job.customerId && s.customerId === job.customerId) ||
        (job.customerName && s.customerName?.trim().toLowerCase() === job.customerName.trim().toLowerCase())
    );

    if (existing) {
      this.selectedSession.set(existing);
      this.chatService.selectSession(existing.id);
    } else {
      // Create or retrieve session from backend
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
        error: () => {
          const fallbackId = `session-${job.customerId || job.id}-${proId}`;
          const fallbackSess: ChatSession = {
            id: fallbackId,
            customerId: job.customerId || '',
            customerName: job.customerName || 'Customer',
            professionalId: proId,
            professionalName: this.currentProName()
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

    const receiverId = session?.customerId || this.selectedChatJob()?.customerId || undefined;
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
            senderId: authUser?.id || this.currentProId(),
            receiverId: receiverId,
            senderName: this.currentProName(),
            senderRole: 'Professional',
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
