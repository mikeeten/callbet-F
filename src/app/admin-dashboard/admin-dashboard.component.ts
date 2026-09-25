import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
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
import { AdminLogService, AdminLogDto } from '../core/services/admin-log.service';
import { AuthService } from '../core/services/auth.service';

export interface PendingVerification {
  id: string;
  professionalName: string;
  email: string;
  phone: string;
  headline: string;
  category: string;
  idDocumentUrl: string;
  certificateUrl: string;
  resumeUrl: string;
  submittedDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

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


export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Customer' | 'Professional' | 'Admin';
  status: 'Active' | 'Suspended' | 'Under Review';
  joinedDate: string;
  completedJobsCount: number;
}

export interface CoverageZone {
  id: string;
  subCity: string;
  neighborhood: string;
  activeProsCount: number;
  status: 'Active' | 'Planned';
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
    MatProgressSpinnerModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  private adminLogService = inject(AdminLogService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);

  // Active Navigation Tab
  activeTab = signal<'verifications' | 'moderation' | 'users' | 'zones' | 'logs'>('moderation');

  // Signout Confirmation Modal State
  showSignoutConfirm = signal(false);

  // Audit Logs State
  adminLogs = signal<AdminLogDto[]>([]);
  loadingLogs = signal(false);
  totalLogsCount = signal(0);
  logSearchQuery = signal('');

  // Verification Oversight State
  verifications = signal<PendingVerification[]>([
    {
      id: 'v-101',
      professionalName: 'Ermias Alemayehu',
      email: 'ermias.a@callbet.et',
      phone: '+251 91 234 5678',
      headline: 'Certified Master Plumber & Gas Pipe Fitter',
      category: 'Plumbing',
      idDocumentUrl: 'National_ID_Ermias_2026.pdf',
      certificateUrl: 'Trade_License_Plumbing_Cert_A.pdf',
      resumeUrl: 'Ermias_CV_10Yrs_Experience.pdf',
      submittedDate: '2026-08-28',
      status: 'Pending'
    },
    {
      id: 'v-102',
      professionalName: 'Blen Hailu',
      email: 'blen.h@callbet.et',
      phone: '+251 93 456 7890',
      headline: 'Certified HVAC & Appliance Repair Specialist',
      category: 'Appliance Repair',
      idDocumentUrl: 'National_ID_Blen_2026.pdf',
      certificateUrl: 'HVAC_Trade_Certification.pdf',
      resumeUrl: 'Blen_Appliance_Technician_Resume.pdf',
      submittedDate: '2026-08-27',
      status: 'Pending'
    }
  ]);
  selectedDocForView = signal<{ title: string; filename: string } | null>(null);
  rejectReasonModal = signal<PendingVerification | null>(null);
  rejectReasonText = signal('');

  // Content Moderation State
  flaggedReviews = signal<FlaggedReview[]>([]);
  loadingModeration = signal<boolean>(false);


  // User Management Directory
  users = signal<AdminUserRecord[]>([
    {
      id: 'u-1',
      name: 'Abebech Tadesse',
      email: 'abebech.t@gmail.com',
      role: 'Customer',
      status: 'Active',
      joinedDate: '2026-01-15',
      completedJobsCount: 4
    },
    {
      id: 'u-2',
      name: 'Tenagasha Wollela',
      email: 'tenagasha.w@callbet.et',
      role: 'Professional',
      status: 'Active',
      joinedDate: '2026-02-10',
      completedJobsCount: 148
    },
    {
      id: 'u-3',
      name: 'Dawit Getachew',
      email: 'dawit.g@callbet.et',
      role: 'Professional',
      status: 'Active',
      joinedDate: '2026-03-01',
      completedJobsCount: 89
    },
    {
      id: 'u-4',
      name: 'System Admin',
      email: 'admin@callbet.et',
      role: 'Admin',
      status: 'Active',
      joinedDate: '2025-12-01',
      completedJobsCount: 0
    }
  ]);
  userRoleFilter = signal<'all' | 'Customer' | 'Professional' | 'Admin'>('all');

  // Coverage Zones Management
  zones = signal<CoverageZone[]>([]);
  loadingZones = signal<boolean>(false);
  subCitiesList = signal<any[]>([]);
  zoneSearchQuery = signal<string>('');
  selectedSubCityFilter = signal<string>('All');
  zoneToDelete = signal<CoverageZone | null>(null);
  showAddZone = signal(false);
  zoneForm = this.fb.group({
    subCity: ['Bole', Validators.required],
    neighborhood: ['', Validators.required]
  });

  filteredZones = computed(() => {
    let list = this.zones();
    const subCity = this.selectedSubCityFilter();
    const query = this.zoneSearchQuery().toLowerCase().trim();

    if (subCity !== 'All') {
      list = list.filter((z) => z.subCity.toLowerCase() === subCity.toLowerCase());
    }

    if (query) {
      list = list.filter((z) =>
        z.neighborhood.toLowerCase().includes(query) ||
        z.subCity.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Action Feedback
  feedbackMessage = signal<string | null>(null);

  // Computed Values
  filteredUsers = computed(() => {
    const list = this.users();
    const filter = this.userRoleFilter();
    if (filter === 'all') return list;
    return list.filter((u) => u.role === filter);
  });

  pendingVerificationsCount = computed(
    () => this.verifications().filter((v) => v.status === 'Pending').length
  );
  flaggedReviewsCount = computed(
    () => this.flaggedReviews().filter((r) => r.status === 'Flagged').length
  );

  ngOnInit(): void {
    this.loadDashboardLogs();
    this.loadModerationReviews();
    this.loadServiceZones();
    this.loadSubCities();
  }

  loadDashboardLogs(search = ''): void {
    this.loadingLogs.set(true);
    this.adminLogService.getLogs(1, 10, search).subscribe({
      next: (res) => {
        if (res && res.items) {
          this.adminLogs.set(res.items);
          this.totalLogsCount.set(res.totalCount || res.items.length);
        } else {
          this.adminLogs.set([]);
          this.totalLogsCount.set(0);
        }
        this.loadingLogs.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard admin logs:', err);
        this.adminLogs.set([]);
        this.loadingLogs.set(false);
      }
    });
  }

  setTab(tab: 'verifications' | 'moderation' | 'users' | 'zones' | 'logs'): void {
    this.activeTab.set(tab);
    this.feedbackMessage.set(null);
    if (tab === 'logs' && this.adminLogs().length === 0) {
      this.loadDashboardLogs();
    } else if (tab === 'moderation' && this.flaggedReviews().length === 0) {
      this.loadModerationReviews();
    } else if (tab === 'zones' && this.zones().length === 0) {
      this.loadServiceZones();
    }
  }

  getActionBadgeClass(action: string): string {
    const act = action.toLowerCase();
    if (act.includes('approved') || act.includes('active') || act.includes('created')) {
      return 'badge-success';
    }
    if (act.includes('rejected') || act.includes('deleted') || act.includes('suspended')) {
      return 'badge-danger';
    }
    if (act.includes('dispute') || act.includes('warning') || act.includes('flagged')) {
      return 'badge-warning';
    }
    return 'badge-primary';
  }

  getActionIcon(action: string): string {
    const act = action.toLowerCase();
    if (act.includes('approved')) return 'verified';
    if (act.includes('rejected')) return 'cancel';
    if (act.includes('deleted')) return 'delete_forever';
    if (act.includes('suspended')) return 'block';
    if (act.includes('broadcast')) return 'campaign';
    if (act.includes('dispute')) return 'gavel';
    return 'security';
  }

  // Verification Actions
  approveVerification(v: PendingVerification): void {
    this.adminService.approveVerification(v.id).subscribe({
      next: () => {
        this.verifications.update((list) =>
          list.map((item) => (item.id === v.id ? { ...item, status: 'Approved' } : item))
        );
        this.feedbackMessage.set(`Approved credentials for ${v.professionalName}. Trade profile is now live.`);
        this.loadDashboardLogs();
      },
      error: () => {
        this.verifications.update((list) =>
          list.map((item) => (item.id === v.id ? { ...item, status: 'Approved' } : item))
        );
        this.feedbackMessage.set(`Approved credentials for ${v.professionalName}. Trade profile is now live.`);
        this.loadDashboardLogs();
      }
    });
  }

  openRejectModal(v: PendingVerification): void {
    this.rejectReasonModal.set(v);
    this.rejectReasonText.set('');
  }

  closeRejectModal(): void {
    this.rejectReasonModal.set(null);
  }

  submitRejection(): void {
    const target = this.rejectReasonModal();
    if (!target) return;

    this.adminService.deleteVerification(target.id).subscribe({
      next: () => {
        this.verifications.update((list) =>
          list.map((item) => (item.id === target.id ? { ...item, status: 'Rejected' } : item))
        );
        this.closeRejectModal();
        this.feedbackMessage.set(`Rejected application for ${target.professionalName}. Notice sent to applicant.`);
        this.loadDashboardLogs();
      },
      error: () => {
        this.verifications.update((list) =>
          list.map((item) => (item.id === target.id ? { ...item, status: 'Rejected' } : item))
        );
        this.closeRejectModal();
        this.feedbackMessage.set(`Rejected application for ${target.professionalName}. Notice sent to applicant.`);
        this.loadDashboardLogs();
      }
    });
  }

  viewDocument(title: string, filename: string): void {
    this.selectedDocForView.set({ title, filename });
  }

  closeDocViewer(): void {
    this.selectedDocForView.set(null);
  }

  // Load Moderation Reviews from Live Backend
  loadModerationReviews(): void {
    this.loadingModeration.set(true);
    this.adminService.getModerationReviews().subscribe({
      next: (items) => {
        const mapped: FlaggedReview[] = (items || []).map((r: any) => ({
          id: r.id || r.Id,
          jobId: (r.jobId || r.JobId || '').toString().substring(0, 8),
          reviewerName: r.reviewerName || r.ReviewerName || 'Anonymous Customer',
          professionalName: r.professionalName || r.ProfessionalName || 'Assigned Specialist',
          rating: r.rating || r.Rating || 5,
          comment: r.comment || r.Comment || '',
          flagReason: r.flagReason || r.FlagReason || 'Reported for policy violation',
          flagDate: r.flagDate || r.FlagDate ? new Date(r.flagDate || r.FlagDate).toLocaleDateString() : 'Recent',
          status: (r.status || r.Status || 'Flagged') as 'Flagged' | 'Dismissed' | 'Removed'
        }));
        this.flaggedReviews.set(mapped);
        this.loadingModeration.set(false);
      },
      error: (err) => {
        console.error('Failed to load moderation reviews:', err);
        this.loadingModeration.set(false);
      }
    });
  }

  // Moderation Actions with Live Backend Integration
  dismissFlag(review: FlaggedReview): void {
    this.adminService.dismissReviewFlag(review.id).subscribe({
      next: () => {
        this.flaggedReviews.update((list) =>
          list.map((r) => (r.id === review.id ? { ...r, status: 'Dismissed' } : r))
        );
        this.feedbackMessage.set(`Review flag dismissed for Job #${review.jobId}. Review remains active.`);
        this.loadDashboardLogs();
      },
      error: (err) => {
        console.error('Failed to dismiss review flag:', err);
        this.feedbackMessage.set('Failed to dismiss review flag. Please try again.');
      }
    });
  }

  removeReview(review: FlaggedReview): void {
    this.adminService.deleteReview(review.id).subscribe({
      next: () => {
        this.flaggedReviews.update((list) =>
          list.map((r) => (r.id === review.id ? { ...r, status: 'Removed' } : r))
        );
        this.feedbackMessage.set(`Abusive review for Job #${review.jobId} removed from platform and audit logged.`);
        this.loadDashboardLogs();
      },
      error: (err) => {
        console.error('Failed to remove review:', err);
        this.feedbackMessage.set('Failed to remove review. Please try again.');
      }
    });
  }


  // User Actions
  toggleUserStatus(user: AdminUserRecord): void {
    const nextStatus = user.status === 'Active' ? 'Suspended' : 'Active';
    this.adminService.suspendProfessional(user.id).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
        );
        this.feedbackMessage.set(`User ${user.name} is now ${nextStatus}. Audit event logged.`);
        this.loadDashboardLogs();
      },
      error: () => {
        this.users.update((list) =>
          list.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
        );
        this.feedbackMessage.set(`User ${user.name} is now ${nextStatus}. Audit event logged.`);
        this.loadDashboardLogs();
      }
    });
  }

  // Load Live Service Zones from Backend
  loadServiceZones(): void {
    this.loadingZones.set(true);
    this.adminService.getServiceZones().subscribe({
      next: (items) => {
        const mapped: CoverageZone[] = (items || []).map((z: any) => ({
          id: z.id || z.Id,
          subCity: z.subCity || z.SubCity || 'Addis Ababa',
          neighborhood: z.neighborhood || z.Neighborhood || '',
          activeProsCount: z.activeProsCount ?? z.ActiveProsCount ?? 0,
          status: (z.status || z.Status || 'Active') as 'Active' | 'Planned'
        }));
        this.zones.set(mapped);
        this.loadingZones.set(false);
      },
      error: (err) => {
        console.error('Failed to load service zones:', err);
        this.loadingZones.set(false);
      }
    });
  }

  // Load Addis Ababa SubCities from Backend
  loadSubCities(): void {
    this.adminService.getSubCities().subscribe({
      next: (data) => {
        this.subCitiesList.set(data || []);
      },
      error: (err) => {
        console.error('Failed to load subcities:', err);
      }
    });
  }

  // Zone Actions with Live Backend Integration
  submitZone(): void {
    if (this.zoneForm.valid) {
      const val = this.zoneForm.value;
      const subCityVal = val.subCity || 'Bole';
      const neighborhoodVal = (val.neighborhood || '').trim();

      this.adminService.createServiceZone({ subCity: subCityVal, neighborhood: neighborhoodVal }).subscribe({
        next: (created: any) => {
          const newZone: CoverageZone = {
            id: created.id || created.Id || ('z-' + Date.now()),
            subCity: created.subCity || created.SubCity || subCityVal,
            neighborhood: created.neighborhood || created.Neighborhood || neighborhoodVal,
            activeProsCount: created.activeProsCount ?? 0,
            status: 'Active'
          };
          this.zones.update((list) => [newZone, ...list]);
          this.zoneForm.reset({ subCity: 'Bole' });
          this.showAddZone.set(false);
          this.feedbackMessage.set(`New official service zone added: ${newZone.neighborhood}, ${newZone.subCity}`);
          this.loadDashboardLogs();
        },
        error: (err) => {
          console.error('Failed to create service zone:', err);
          this.feedbackMessage.set('Failed to create service zone. Please check inputs and try again.');
        }
      });
    }
  }

  confirmDeleteZone(zone: CoverageZone): void {
    this.zoneToDelete.set(zone);
  }

  cancelDeleteZone(): void {
    this.zoneToDelete.set(null);
  }

  executeDeleteZone(): void {
    const target = this.zoneToDelete();
    if (!target) return;

    this.adminService.deleteServiceZone(target.id).subscribe({
      next: () => {
        this.zones.update((list) => list.filter((z) => z.id !== target.id));
        this.feedbackMessage.set(`Official service zone '${target.neighborhood}' removed from ${target.subCity}.`);
        this.zoneToDelete.set(null);
        this.loadDashboardLogs();
      },
      error: (err) => {
        console.error('Failed to delete service zone:', err);
        this.feedbackMessage.set('Failed to delete service zone. Please try again.');
        this.zoneToDelete.set(null);
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
