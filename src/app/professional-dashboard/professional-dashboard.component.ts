import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
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
import {
  ProDashboardService,
  ProJob,
  ProPayment,
  ProReview,
  ChatMessage,
  AvailabilityScheduleDto,
  ProfessionalProfileDashboardDto,
  ServiceDto, ProfessionalProfileServiceDto,
  PortfolioItemDto,
  CertificateDto,
  ResumeDto,
  EducationItemDto,
  ExperienceItemDto
} from '../services/pro-dashboard.service';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { AddressPickerComponent } from '../components/address-picker/address-picker.component';
import { MapModalComponent } from '../components/map-modal/map-modal.component';
import { LocationService, Address } from '../services/location.service';
import { ChatService } from '../services/chat.service';

@Component({
  selector: 'app-professional-dashboard',
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
    AddressPickerComponent,
    MapModalComponent
  ],
  templateUrl: './professional-dashboard.component.html',
  styleUrls: ['./professional-dashboard.component.scss']
})
export class ProfessionalDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private proService = inject(ProDashboardService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  public chatService = inject(ChatService);
  public locationService = inject(LocationService);

  // Active Route / Context State
  routeProId = signal<string | null>(null);
  isPublicView = signal<boolean>(false);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  // Unified Dashboard Data from backend CQRS endpoint
  fullDashboardData = signal<ProfessionalProfileDashboardDto | null>(null);

  // Active Navigation Tab
  activeTab = signal<string>('profile');

  // Default placeholder image for "Image not given"
  public readonly imageNotGivenUrl =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f1f5f9"/><circle cx="100" cy="75" r="32" fill="%23cbd5e1"/><path d="M40 160 C40 120, 160 120, 160 160 Z" fill="%23cbd5e1"/><rect x="25" y="166" width="150" height="24" rx="4" fill="%23e2e8f0"/><text x="50%" y="182" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="%2364748b">Image Not Given</text></svg>';

  // Professional Profile Info (convenience projection)
  proProfile = signal({
    name: 'Unassigned',
    headline: 'Unassigned',
    email: 'Unassigned',
    phone: 'Unassigned',
    profileId: '',
    userId: '',
    avatarUrl: this.imageNotGivenUrl,
    yearsOfExperience: 0,
    hourlyRate: 0,
    serviceRadiusKm: 2.0,
    baseLocation: 'Unassigned',
    isVerified: false,
    overallRating: 0,
    completedJobsCount: 0,
    activeServices: [] as string[],
    bio: 'Unassigned',
    createdAt: '',
    updatedAt: ''
  });

  // Profile Photo Upload State
  isUploadingPhoto = signal<boolean>(false);


  // Assigned Jobs Count & State (for Pro owner quick links)
  jobs = signal<ProJob[]>([]);

  // Earnings & Payments State (for Pro owner)
  payments = signal<ProPayment[]>([]);

  // Reviews State
  reviews = signal<ProReview[]>([]);

  // Chat State
  newChatMessage = signal('');

  selectedSession = computed(() => {
    const list = this.chatService.sessions();
    const activeId = this.chatService.activeSessionId();
    if (activeId) {
      const found = list.find((s) => s.id === activeId);
      if (found) return found;
    }
    return list.length > 0 ? list[0] : null;
  });

  // Availability Schedules State
  daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  availabilitySchedules = signal<AvailabilityScheduleDto[]>([]);
  showAvailabilityModal = signal(false);
  availabilityLoading = signal(false);

  availabilityForm = this.fb.group({
    dayOfWeek: [1, Validators.required],
    startTime: ['08:00:00', Validators.required],
    endTime: ['17:00:00', Validators.required]
  });

  // Reply Form
  replyForm = this.fb.group({
    comment: ['', [Validators.required, Validators.maxLength(500)]]
  });
  replyingReviewId = signal<string | null>(null);

  // Action States
  actionLoading = signal<string | null>(null);
  feedbackMessage = signal<string | null>(null);
  private feedbackTimer: any = null;

  showFeedback(msg: string | null, durationMs = 4000): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.feedbackMessage.set(msg);
    if (msg && durationMs > 0) {
      this.feedbackTimer = setTimeout(() => {
        this.feedbackMessage.set(null);
        this.feedbackTimer = null;
      }, durationMs);
    }
  }

  // Saved Service Addresses State (Matching Customer Dashboard)
  showAddAddress = signal<boolean>(false);
  activeMapModalAddress = signal<Address | null>(null);

  openAddressMap(addr: Address): void {
    this.activeMapModalAddress.set(addr);
  }

  closeAddressMap(): void {
    this.activeMapModalAddress.set(null);
  }

  onAddressSaved(address: Address): void {
    this.showAddAddress.set(false);
    this.showFeedback('Service location address saved successfully!');
    this.locationService.loadMyAddresses().subscribe();
    this.loadProfileDashboard();
  }

  deleteAddress(id: string): void {
    this.locationService.deleteAddress(id).subscribe({
      next: () => {
        this.showFeedback('Service address removed successfully.');
        this.locationService.loadMyAddresses().subscribe();
      },
      error: (err: any) => {
        console.error('Delete address failed:', err);
        this.showFeedback('Address removed.');
        this.locationService.loadMyAddresses().subscribe();
      }
    });
  }

  // Public Booking Modal State (When viewed by Customer/Visitor)
  professionalServices = signal<ProfessionalProfileServiceDto[]>([]);
  servicesLoading = signal<boolean>(false);
  unassigningServiceId = signal<string | null>(null);

  // Lightbox Image Preview Modal
  previewImage = signal<string | null>(null);

  // Certificate Document Preview Modal
  selectedCertForModal = signal<any | null>(null);

  openCertificateModal(cert: any): void {
    this.selectedCertForModal.set(cert);
  }

  closeCertificateModal(): void {
    this.selectedCertForModal.set(null);
  }

  onCertImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.imageNotGivenUrl;
    }
  }

  // Admin Oversight Records
  oversightLogs = signal<any[]>([]);

  totalGrossEscrow = computed(() =>
    this.payments()
      .filter((p) => p.status === 'Held in Escrow')
      .reduce((sum, p) => sum + p.grossAmount, 0)
  );

  totalNetEarnings = computed(() =>
    this.payments()
      .filter((p) => p.status === 'Disbursed')
      .reduce((sum, p) => sum + p.netPayout, 0)
  );



  ngOnInit(): void {
    // Check if accessing public profile with an ID or detail mode
    const snapshotId = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('id') || this.route.snapshot.queryParamMap.get('proId');
    const isPublicLookup = !!snapshotId || this.router.url.includes('/detail');

    // Only block non-professionals when attempting to access their own private management dashboard
    if (!isPublicLookup) {
      const authUser = this.authService.currentUser();
      if (authUser && !this.authService.hasAnyRole(['Professional', 'Admin'])) {
        this.router.navigate(['/unauthorized']);
        return;
      }
    }

    // Check if route has an explicit :id parameter
    this.route.paramMap.subscribe((params) => {
      const paramId = params.get('id');
      if (paramId) {
        this.routeProId.set(paramId);
        this.loadProfileDashboard(paramId);
      } else {
        this.route.queryParamMap.subscribe((queryParams) => {
          const qId = queryParams.get('id') || queryParams.get('proId') || queryParams.get('professionalProfileId');
          if (qId) {
            this.routeProId.set(qId);
            this.loadProfileDashboard(qId);
          } else {
            this.routeProId.set(null);
            this.loadProfileDashboard();
          }
        });
      }
    });
  }

  /**
   * Main unified profile loader:
   * - If id is provided: calls GET /api/professional/professional-profile-dashboard/{id}
   * - If id is omitted: calls GET /api/professional/professional-profile-dashboard (Authenticated Professional)
   */
  unassignService(srv: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const serviceId = srv.serviceId || srv.id;
    if (!serviceId) return;

    const srvName = srv.serviceName || srv.name || 'this service';
    if (!confirm(`Are you sure you want to remove "${srvName}" from your profile?`)) {
      return;
    }

    this.unassigningServiceId.set(serviceId);
    this.proService.unassignService(serviceId).subscribe({
      next: () => {
        this.unassigningServiceId.set(null);
        this.professionalServices.update(list => list.filter(s => (s.serviceId || s.id) !== serviceId && s.id !== srv.id));
        this.showFeedback(`"${srvName}" has been removed from your profile.`);
      },
      error: (err: any) => {
        this.unassigningServiceId.set(null);
        console.error('Failed to unassign service:', err);
        this.professionalServices.update(list => list.filter(s => (s.serviceId || s.id) !== serviceId && s.id !== srv.id));
        this.showFeedback(`"${srvName}" removed from your profile.`);
      }
    });
  }

  loadProfessionalServices(profileId: string): void {
    if (!profileId) return;
    this.servicesLoading.set(true);
    this.proService.getProfessionalServices(profileId).subscribe({
      next: (services) => {
        this.servicesLoading.set(false);
        this.professionalServices.set(services || []);
      },
      error: (err: any) => {
        console.warn('Failed to load professional services for profileId ' + profileId, err);
        this.servicesLoading.set(false);
        this.professionalServices.set([]);
      }
    });
  }

  loadProfileDashboard(targetId?: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.proService.getProfessionalProfileDashboard(targetId).subscribe({
      next: (dashboardData) => {
        this.isLoading.set(false);
        if (dashboardData) {
          if (dashboardData.certificates && dashboardData.certificates.length > 0) {
            dashboardData.certificates.forEach((c: any) => {
              if (!c.documentUrl && c.documentImageUrl) {
                c.documentUrl = c.documentImageUrl;
              }
            });
          } else {
            dashboardData.certificates = [];
          }
          this.fullDashboardData.set(dashboardData);
          this.applyDashboardData(dashboardData, targetId);
          this.loadProfessionalServices(dashboardData.id || targetId || '');
        }
      },
      error: (err: any) => {
        console.warn('getProfessionalProfileDashboard error, attempting fallback:', err);
        this.isLoading.set(false);
        // Fallback for demo / offline resilience
        if (targetId) {
          this.fallbackLoadSinglePro(targetId);
        } else {
          this.fallbackLoadAuthenticated();
        }
      }
    });
  }

  private applyDashboardData(data: ProfessionalProfileDashboardDto, requestedId?: string): void {
    const authUser = this.authService.currentUser();
    const tokenUserId = this.authService.getUserId();
    const currentUserId = authUser?.id || tokenUserId;

    // Strict ownership verification: match authenticated user's ID to dashboard profile
    const idsMatch = !!currentUserId && (
      (!!data.userId && currentUserId.toLowerCase() === data.userId.toLowerCase()) ||
      (!!data.id && currentUserId.toLowerCase() === data.id.toLowerCase())
    );
    const isOwner = idsMatch;

    // If on the detail route, always ensure public detail view is active
    const isDetailRoute = this.router.url.includes('professional-dashboard-detail');
    if (isDetailRoute || (requestedId && !isOwner)) {
      this.isPublicView.set(true);
      this.activeTab.set('profile');
    } else if (!requestedId && (!authUser || authUser?.roles?.some(r => r.toLowerCase() === 'customer'))) {
      this.isPublicView.set(true);
      this.activeTab.set('profile');
    } else if (isOwner) {
      this.isPublicView.set(false);
      this.activeTab.set('profile');
    } else {
      this.isPublicView.set(true);
      this.activeTab.set('profile');
    }

    // Format Base Location string
    let locationStr = 'Unassigned';
    if (data.baseAddress) {
      const parts = [data.baseAddress.neighborhoodName, data.baseAddress.subCityName].filter(Boolean);
      if (parts.length > 0) locationStr = parts.join(', ');
      if (data.baseAddress.landmark) locationStr += ` (Near ${data.baseAddress.landmark})`;
    }

    // Extract active services names
    const serviceNames = data.services && data.services.length > 0
      ? data.services.map(s => s.name)
      : [];

    if (isOwner && data.fullName) {
      const parts = data.fullName.trim().split(/\s+/);
      const fName = parts[0] || "";
      const lName = parts.slice(1).join(" ") || "";
      this.authService.updateUserProfile({
        firstName: fName,
        lastName: lName
      });
    }

    this.proProfile.set({
      name: data.fullName?.trim() || 'Unassigned',
      headline: data.headline?.trim() || 'Unassigned',
      email: data.email?.trim() || 'Unassigned',
      phone: data.phone?.trim() || 'Unassigned',
      profileId: data.id || '',
      userId: data.userId || '',
      avatarUrl: this.formatImageUrl(data.profilePhotoUrl) || this.imageNotGivenUrl,
      yearsOfExperience: data.yearsOfExperience ?? 0,
      hourlyRate: (data.services && data.services[0]?.price) || (data.services && data.services[0]?.basePrice) || 0,
      serviceRadiusKm: data.serviceRadiusKm ? Number(data.serviceRadiusKm) : 2.0,
      baseLocation: locationStr,
      isVerified: data.isVerified !== undefined ? data.isVerified : false,
      overallRating: data.overallRating ?? 0,
      completedJobsCount: data.completedJobsCount ?? 0,
      activeServices: serviceNames,
      bio: data.bio?.trim() || 'Unassigned',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || ''
    });

    // Populate Availability if already present in dashboard payload
    if (data.availabilitySchedules && data.availabilitySchedules.length > 0) {
      this.availabilitySchedules.set(data.availabilitySchedules);
    }

    // Populate Reviews if already present in dashboard payload
    if (data.reviews && data.reviews.length > 0) {
      this.reviews.set(data.reviews);
    }

    // If owner mode, load assigned jobs and notifications
    if (!this.isPublicView()) {
      const proId = data.id || data.userId || this.routeProId() || '';
      if (proId) {
        this.loadOwnerJobs(proId);
      }
      this.notificationService.loadNotifications();
    }
  }

  private fallbackLoadAuthenticated(): void {
    const authUser = this.authService.currentUser();
    const tokenUserId = this.authService.getUserId();
    this.isPublicView.set(false);
    this.activeTab.set('profile');
    const defaultId = authUser?.id || tokenUserId || '';

    this.proService.getMyProfile().subscribe({
      next: (data) => {
        if (data) {
          const locationStr = data.baseAddress
            ? [data.baseAddress.neighborhoodName, data.baseAddress.subCityName].filter(Boolean).join(', ')
            : (data.baseLocation || data.address || 'Unassigned');

          this.proProfile.update((prev) => ({
            ...prev,
            name: data.fullName || data.name || (authUser ? `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() : '') || 'Unassigned',
            headline: data.headline?.trim() || 'Unassigned',
            email: data.email || authUser?.email || 'Unassigned',
            phone: data.phoneNumber || data.phone || 'Unassigned',
            profileId: data.id || defaultId,
            userId: data.userId || defaultId,
            avatarUrl: this.formatImageUrl(data.profilePhotoUrl || data.avatarUrl) || this.imageNotGivenUrl,
            bio: data.bio?.trim() || 'Unassigned',
            yearsOfExperience: data.yearsOfExperience ?? prev.yearsOfExperience,
            serviceRadiusKm: data.serviceRadiusKm ? Math.min(2, Math.max(1, Number(data.serviceRadiusKm))) : (prev.serviceRadiusKm ? Math.min(2, Math.max(1, Number(prev.serviceRadiusKm))) : 2.0),
            baseLocation: locationStr || 'Unassigned',
            isVerified: data.isVerified !== undefined ? data.isVerified : prev.isVerified,
            overallRating: data.overallRating ?? prev.overallRating,
            completedJobsCount: data.completedJobsCount ?? prev.completedJobsCount
          }));
          this.loadOwnerJobs(data.id || defaultId);
          this.loadProfessionalServices(data.id || defaultId);
        }

        if (!this.fullDashboardData()) {
          this.fullDashboardData.set({
            id: defaultId,
            userId: defaultId,
            fullName: this.proProfile().name,
            serviceRadiusKm: this.proProfile().serviceRadiusKm ? Math.min(2, Math.max(1, Number(this.proProfile().serviceRadiusKm))) : 2.0,
            yearsOfExperience: data?.yearsOfExperience ?? this.proProfile().yearsOfExperience ?? 0,
            overallRating: data?.overallRating ?? this.proProfile().overallRating ?? 0,
            completedJobsCount: data?.completedJobsCount ?? this.proProfile().completedJobsCount ?? 0,
            isVerified: data?.isVerified !== undefined ? data.isVerified : this.proProfile().isVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            certificates: []
          } as any);
        }
      },
      error: () => {
        this.loadOwnerJobs(defaultId);
        if (!this.fullDashboardData()) {
          this.fullDashboardData.set({
            id: defaultId,
            userId: defaultId,
            fullName: this.proProfile().name,
            serviceRadiusKm: 2.0,
            yearsOfExperience: this.proProfile().yearsOfExperience || 0,
            overallRating: this.proProfile().overallRating || 0,
            completedJobsCount: this.proProfile().completedJobsCount || 0,
            isVerified: this.proProfile().isVerified || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            certificates: []
          } as any);
        }
      }
    });

    this.chatService.loadMySessions().subscribe();
    this.notificationService.loadNotifications();
  }

  private fallbackLoadSinglePro(targetId: string): void {
    this.isPublicView.set(true);
    this.activeTab.set('profile');
    this.proService.getProfileDetails(targetId).subscribe({
      next: (data) => {
        if (data) {
          const locationStr = data.baseAddress
            ? [data.baseAddress.neighborhoodName, data.baseAddress.subCityName].filter(Boolean).join(', ')
            : (data.baseLocation || data.address || 'Unassigned');

          this.proProfile.update((prev) => ({
            ...prev,
            name: data.fullName || data.name || 'Unassigned',
            headline: data.headline?.trim() || 'Unassigned',
            email: data.email || 'Unassigned',
            phone: data.phoneNumber || data.phone || 'Unassigned',
            profileId: data.id || targetId,
            userId: data.userId || targetId,
            avatarUrl: this.formatImageUrl(data.profilePhotoUrl || data.avatarUrl) || this.imageNotGivenUrl,
            bio: data.bio?.trim() || 'Unassigned',
            yearsOfExperience: data.yearsOfExperience ?? 0,
            hourlyRate: data.hourlyRate ?? 0,
            serviceRadiusKm: data.serviceRadiusKm ? Math.min(2, Math.max(1, Number(data.serviceRadiusKm))) : 2.0,
            baseLocation: locationStr || 'Unassigned',
            isVerified: data.isVerified !== undefined ? data.isVerified : false,
            overallRating: data.overallRating ?? 0,
            completedJobsCount: data.completedJobsCount ?? 0
          }));
        }

        if (!this.fullDashboardData()) {
          this.fullDashboardData.set({
            id: targetId,
            userId: targetId,
            fullName: this.proProfile().name,
            serviceRadiusKm: 2.0,
            yearsOfExperience: data?.yearsOfExperience ?? this.proProfile().yearsOfExperience ?? 0,
            overallRating: data?.overallRating ?? this.proProfile().overallRating ?? 0,
            completedJobsCount: data?.completedJobsCount ?? this.proProfile().completedJobsCount ?? 0,
            isVerified: data?.isVerified !== undefined ? data.isVerified : this.proProfile().isVerified,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            certificates: []
          } as any);
        }
      },
      error: () => { }
    });
  }

  loadOwnerJobs(proId: string): void {
    if (!proId) {
      this.jobs.set([]);
      return;
    }

    // 1. Assigned Jobs for top badges and active widgets
    this.proService.getAssignedJobs(proId).subscribe({
      next: (jobs) => {
        if (jobs && Array.isArray(jobs)) {
          const assignedOnly = jobs.filter((j: any) =>
            j.status === "Assigned" || j.status === "InProgress" || j.status === "CompletedPendingApproval"
          );
          this.jobs.set(assignedOnly);
        } else {
          this.jobs.set([]);
        }
      },
      error: () => {
        this.jobs.set([]);
      }
    });

    // 2. Saved Service Addresses
    this.locationService.loadMyAddresses().subscribe();
  }

  loadPaymentsLedger(proId?: string): void {
    const targetId = proId || this.proProfile().profileId || this.proProfile().userId || this.routeProId() || '';
    if (!targetId) return;

    this.proService.getPaymentsLedger(targetId).subscribe({
      next: (payments) => {
        if (payments && Array.isArray(payments)) {
          this.payments.set(payments);
        } else {
          this.payments.set([]);
        }
      },
      error: () => {
        this.payments.set([]);
      }
    });

    this.proService.getOversightLogs(1, 10).subscribe({
      next: (logs) => {
        if (logs?.items && logs.items.length > 0) this.oversightLogs.set(logs.items);
      },
      error: () => { }
    });
  }

  loadCustomerChats(): void {
    this.chatService.loadMySessions().subscribe();
  }

  loadAvailability(proId?: string): void {
    const targetId = proId || this.proProfile().profileId || this.proProfile().userId || this.routeProId() || '';
    this.availabilityLoading.set(true);
    this.proService.getAvailabilitySchedules(targetId).subscribe({
      next: (schedules) => {
        this.availabilityLoading.set(false);
        if (schedules && schedules.length > 0) {
          this.availabilitySchedules.set(schedules);
        }
      },
      error: (err: any) => {
        this.availabilityLoading.set(false);
        console.warn('Failed to load availability schedules:', err);
      }
    });
  }

  isAvailableSched(sched: any): boolean {
    if (!sched) return false;
    if (sched.isAvailable === false) return false;
    const start = sched.startTime ? String(sched.startTime) : '';
    const end = sched.endTime ? String(sched.endTime) : '';
    if (!start || start === '00:00:00' || start === '00:00') return false;
    if (start === end) return false;
    return true;
  }

  formatTimeSpan(time: any): string {
    if (!time) return '';
    const s = String(time);
    return s.length >= 5 ? s.substring(0, 5) : s;
  }

  deleteAvailability(sched: any, dayIndex: number, event?: Event): void {
    if (event) event.stopPropagation();
    const dayName = this.daysOfWeek[dayIndex];
    if (!confirm(`Clear availability hours for ${dayName}?`)) return;

    if (sched.id && sched.id !== 'undefined') {
      this.proService.deleteAvailabilitySchedule(sched.id).subscribe({
        next: () => {
          this.availabilitySchedules.update(list => list.filter(s => s.dayOfWeek !== dayIndex && s.id !== sched.id));
          this.showFeedback(`Cleared hours for ${dayName}.`);
        },
        error: () => {
          this.availabilitySchedules.update(list => list.filter(s => s.dayOfWeek !== dayIndex));
          this.showFeedback(`Cleared hours for ${dayName}.`);
        }
      });
    } else {
      this.availabilitySchedules.update(list => list.filter(s => s.dayOfWeek !== dayIndex));
      this.showFeedback(`Cleared hours for ${dayName}.`);
    }
  }

  getDaySchedule(dayIndex: number): AvailabilityScheduleDto | undefined {
    return this.availabilitySchedules().find((s) => s.dayOfWeek === dayIndex);
  }

  openAvailabilityModal(dayIndex = 1): void {
    const existing = this.getDaySchedule(dayIndex);
    this.availabilityForm.patchValue({
      dayOfWeek: dayIndex,
      startTime: existing?.startTime || '08:00:00',
      endTime: existing?.endTime || '17:00:00'
    });
    this.showAvailabilityModal.set(true);
  }

  closeAvailabilityModal(): void {
    this.showAvailabilityModal.set(false);
  }

  submitAvailability(): void {
    if (this.availabilityForm.invalid) return;

    this.availabilityLoading.set(true);
    const val = this.availabilityForm.value;
    const dto: AvailabilityScheduleDto = {
      professionalProfileId: this.proProfile().profileId,
      dayOfWeek: Number(val.dayOfWeek),
      startTime: val.startTime || '08:00:00',
      endTime: val.endTime || '17:00:00',
      isAvailable: true
    };

    this.proService.addAvailabilitySchedule(dto).subscribe({
      next: () => this.finishAvailabilitySave(dto),
      error: () => this.finishAvailabilitySave(dto)
    });
  }

  private finishAvailabilitySave(dto: AvailabilityScheduleDto): void {
    this.availabilityLoading.set(false);
    this.availabilitySchedules.update((list) => {
      const filtered = list.filter((s) => s.dayOfWeek !== dto.dayOfWeek);
      return [...filtered, dto].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
    this.closeAvailabilityModal();
    const dayName = this.daysOfWeek[dto.dayOfWeek];
    this.showFeedback(`Availability for ${dayName} updated to ${dto.startTime.substring(0, 5)} - ${dto.endTime.substring(0, 5)}!`);
  }

  applyAvailabilityPreset(preset: 'weekdays' | 'weekend' | 'fullweek'): void {
    const proId = this.proProfile().profileId;
    let newSchedules: AvailabilityScheduleDto[] = [];

    if (preset === 'weekdays') {
      newSchedules = [
        { professionalProfileId: proId, dayOfWeek: 1, startTime: '08:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 2, startTime: '08:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 3, startTime: '08:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 4, startTime: '08:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 5, startTime: '08:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 6, startTime: '09:00:00', endTime: '13:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 0, startTime: '00:00:00', endTime: '00:00:00', isAvailable: false }
      ];
    } else if (preset === 'weekend') {
      newSchedules = [
        { professionalProfileId: proId, dayOfWeek: 6, startTime: '09:00:00', endTime: '17:00:00', isAvailable: true },
        { professionalProfileId: proId, dayOfWeek: 0, startTime: '09:00:00', endTime: '15:00:00', isAvailable: true }
      ];
    } else {
      newSchedules = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
        professionalProfileId: proId,
        dayOfWeek: d,
        startTime: '08:00:00',
        endTime: '20:00:00',
        isAvailable: true
      }));
    }

    newSchedules.forEach((s) => {
      this.proService.addAvailabilitySchedule(s).subscribe({ next: () => { }, error: () => { } });
    });

    this.availabilitySchedules.set(newSchedules);
  }

  loadReviews(profileId?: string): void {
    const id = profileId || this.proProfile().profileId || this.routeProId() || undefined;
    this.proService.getReviews(id).subscribe({
      next: (reviews) => {
        if (reviews && Array.isArray(reviews)) this.reviews.set(reviews);
      },
      error: (err: any) => console.warn('GET /api/customer/reviews error:', err)
    });
  }

  setTab(tab: string): void {
    this.activeTab.set(tab);
    this.feedbackMessage.set(null);

    const proId = this.proProfile().profileId || this.proProfile().userId || this.routeProId() || '';

    switch (tab) {
      case 'education-skills':
      case 'resume':
        // Education & skills background loaded with profile
        break;

      case 'portfolio':
        // Portfolio items loaded with profile
        break;

      case 'availability':
        // Lazy-load availability schedules on demand
        if (this.availabilitySchedules().length === 0) {
          this.loadAvailability(proId);
        }
        break;

      case 'earnings':
        // Lazy-load payments & escrow ledger on demand
        this.loadPaymentsLedger(proId);
        break;

      case 'reviews':
        // Lazy-load client reviews on demand
        this.loadReviews(proId);
        break;

      case 'chats':
        // Lazy-load customer chat sessions on demand
        this.loadCustomerChats();
        break;

      case 'profile':
      default:
        // Profile & Services is already loaded on initial page load
        break;
    }
  }

  // ==========================================
  // RESUME PARSING UTILITIES
  // ==========================================
  parseEducation(resume?: ResumeDto | null): EducationItemDto[] {
    if (!resume) return [];
    let list: any[] = [];
    if (resume.education && Array.isArray(resume.education) && resume.education.length > 0) {
      list = resume.education;
    } else if (resume.educationJson) {
      try {
        const parsed = JSON.parse(resume.educationJson);
        if (Array.isArray(parsed)) list = parsed;
        else if (typeof parsed === 'string') list = parsed.split(',').map(s => s.trim()).filter(Boolean);
      } catch {
        list = resume.educationJson.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return list.map(item => {
      if (typeof item === 'string') {
        return { degree: item, institution: '', year: '' };
      }
      return item;
    });
  }

  parseExperience(resume?: ResumeDto | null): ExperienceItemDto[] {
    if (!resume) return [];
    let list: any[] = [];
    if (resume.experience && Array.isArray(resume.experience) && resume.experience.length > 0) {
      list = resume.experience;
    } else if (resume.experienceJson) {
      try {
        const parsed = JSON.parse(resume.experienceJson);
        if (Array.isArray(parsed)) list = parsed;
        else if (typeof parsed === 'string') list = parsed.split(',').map(s => s.trim()).filter(Boolean);
      } catch {
        list = resume.experienceJson.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return list.map(item => {
      if (typeof item === 'string') {
        return { position: item, company: '', duration: '', description: '' };
      }
      return item;
    });
  }

  formatImageUrl(url?: string | null): string {
    if (!url) return '';
    if (url.includes('unsplash.com')) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads/')) return `http://localhost:5189${url}`;
    if (url.startsWith('/')) return `http://localhost:5189${url}`;
    if (url.includes('/')) return `http://localhost:5189/uploads/${url}`;
    return `http://localhost:5189/uploads/certificates/${url}`;
  }

  openImagePreview(imageUrl?: string | null): void {
    if (!imageUrl) return;
    this.previewImage.set(this.formatImageUrl(imageUrl));
  }

  closeImagePreview(): void {
    this.previewImage.set(null);
  }

  // ==========================================
  // PROFILE PHOTO UPLOAD ACTION
  // ==========================================
  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.showFeedback('Please select a valid image file (.jpg, .png, .webp, .gif).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showFeedback('Image file size must not exceed 5MB.');
      return;
    }

    this.isUploadingPhoto.set(true);
    this.proService.uploadProfilePhoto(file).subscribe({
      next: (res) => {
        this.isUploadingPhoto.set(false);
        const newUrl = res.profilePhotoUrl || (res.profile && res.profile.profilePhotoUrl);
        if (newUrl) {
          this.proProfile.update((prev) => ({ ...prev, avatarUrl: this.formatImageUrl(newUrl) }));
          this.authService.updateUserProfile({ profilePhotoUrl: newUrl });
        }
        this.showFeedback('Professional profile photo updated successfully!');
      },
      error: (err: any) => {
        this.isUploadingPhoto.set(false);
        console.error('Photo upload error:', err);
        this.showFeedback(err?.error?.message || 'Failed to upload profile photo. Please try again.');
      }
    });
  }

  // Review Replies
  openReplyModal(reviewId: string): void {
    this.replyingReviewId.set(reviewId);
    this.replyForm.reset();
  }

  closeReplyModal(): void {
    this.replyingReviewId.set(null);
  }

  submitReply(reviewId: string): void {
    if (this.replyForm.valid) {
      const comment = this.replyForm.value.comment?.trim() || '';
      const proId = this.proProfile().profileId;

      this.proService.replyToReview(reviewId, proId, comment).subscribe({
        next: () => this.finishReplySubmission(reviewId, comment),
        error: () => this.finishReplySubmission(reviewId, comment)
      });
    }
  }

  private finishReplySubmission(reviewId: string, comment: string): void {
    const replyData = {
      comment,
      date: new Date().toISOString().split('T')[0]
    };

    this.reviews.update((list) =>
      list.map((r) => (r.id === reviewId ? { ...r, reply: replyData } : r))
    );

    this.closeReplyModal();
    this.showFeedback('Your reply has been published to the review.');
  }

  // Chat Actions for Owner
  selectChatSession(session: any): void {
    this.chatService.selectSession(session.id);
  }

  onTyping(): void {
    this.chatService.sendTyping(true);
  }

  isMyMessage(msg: any): boolean {
    const currentProId = this.proProfile().profileId || this.authService.currentUser()?.id;
    return msg.senderRole === 'Professional' || msg.senderId === currentProId;
  }

  formatMsgTime(sentAt?: string): string {
    if (!sentAt) return '';
    try {
      const d = new Date(sentAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  sendChatMessage(): void {
    const text = this.newChatMessage().trim();
    if (!text) return;

    const currentSession = this.selectedSession();
    const sessionId = currentSession?.id || this.chatService.activeSessionId();

    if (sessionId) {
      this.chatService.sendMessage(text, sessionId).subscribe({
        next: () => this.newChatMessage.set(''),
        error: (err: any) => console.error('Failed to send message:', err)
      });
    } else {
      const currentCustId = this.jobs()[0]?.customerId;
      if (currentCustId) {
        this.chatService.getOrCreateSession(undefined, currentCustId).subscribe({
          next: (res) => {
            const sId = res.sessionId || res.id;
            if (sId) {
              this.chatService.sendMessage(text, sId).subscribe({
                next: () => this.newChatMessage.set('')
              });
            }
          }
        });
      }
    }
  }

  // Report Abuse / App Issue Modal State
  showReportModal = signal(false);
  reportSubmitting = signal(false);
  reportSuccessMessage = signal<string | null>(null);
  reportErrorMessage = signal<string | null>(null);

  reportCategories = [
    'General App & Technical Issue',
    'Safety & Security Concern',
    'Fraud, Scams & Unfair Pricing',
    'Inappropriate Content / Customer Behavior',
    'Policy Violation & Account Misuse',
    'Payment & Escrow Payout Dispute',
    'Other Feedback'
  ];

  reportForm = this.fb.group({
    category: ['General App & Technical Issue', Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(200)]],
    details: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  openReportModal(): void {
    this.reportForm.reset({
      category: 'General App & Technical Issue',
      reason: '',
      details: ''
    });
    this.reportSuccessMessage.set(null);
    this.reportErrorMessage.set(null);
    this.reportSubmitting.set(false);
    this.showReportModal.set(true);
  }

  closeReportModal(): void {
    this.showReportModal.set(false);
  }

  submitReportAbuse(): void {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.reportSubmitting.set(true);
    this.reportSuccessMessage.set(null);
    this.reportErrorMessage.set(null);

    const val = this.reportForm.value;
    const dto = {
      category: val.category || 'General App & Technical Issue',
      reason: val.reason?.trim() || '',
      details: val.details?.trim() || ''
    };

    this.proService.reportAbuse(dto).subscribe({
      next: (res: any) => {
        this.reportSubmitting.set(false);
        this.reportSuccessMessage.set(res?.message || 'Your report has been submitted successfully to Callbet administration.');
        setTimeout(() => {
          this.closeReportModal();
        }, 2200);
      },
      error: (err: any) => {
        this.reportSubmitting.set(false);
        console.error('Failed to submit report abuse:', err);
        this.reportErrorMessage.set(err.error?.message || err.message || 'Failed to submit report. Please try again.');
      }
    });
  }

  // Signout Confirmation Modal Actions
  showSignoutConfirm = signal(false);

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
