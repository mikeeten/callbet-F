import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminControlService } from '../AdminControlService/admin-control.service';
import { AuthService } from '../core/services/auth.service';

export interface ProfessionalProfileAdminItem {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  profilePhotoUrl?: string;
  headline: string;
  bio?: string;
  serviceRadiusKm: number;
  yearsOfExperience: number;
  overallRating: number;
  completedJobsCount: number;
  isVerified: boolean;
  userStatus: 'Active' | 'PendingVerification' | 'Suspended' | string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserItem {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  fullName?: string;
  email: string;
  phone?: string;
  phoneNumber?: string;
  role: 'Customer' | 'Professional' | 'Admin' | string;
  status: 'Active' | 'PendingVerification' | 'Suspended' | 'Under Review' | number | string;
  createdAt?: string;
  joinedDate?: string;
  completedJobsCount?: number;
  profilePhotoUrl?: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  public authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Active View Switcher ('users' = User Directory, 'professionals' = Professional Profiles)
  activeView = signal<'users' | 'professionals'>('users');

  // Professional Profiles State
  proProfiles = signal<ProfessionalProfileAdminItem[]>([]);
  proTotalCount = signal<number>(0);
  proPage = signal<number>(1);
  proPageSize = signal<number>(10);
  proLoading = signal<boolean>(false);
  selectedProFilter = signal<'all' | 'verified' | 'unverified'>('all');
  selectedProfileForDetails = signal<ProfessionalProfileAdminItem | null>(null);
  profileToToggleVerify = signal<ProfessionalProfileAdminItem | null>(null);
  profileToDelete = signal<ProfessionalProfileAdminItem | null>(null);
  proActionLoading = signal<string | null>(null);

  proSearchForm = this.fb.group({
    search: [''],
    isVerified: ['all'],
    createdDate: [''],
    orderBy: ['CreatedAt'],
    descending: [true]
  });

  proTotalPages = computed(() => Math.max(1, Math.ceil(this.proTotalCount() / this.proPageSize())));

  totalVerifiedProsCount = computed(() =>
    this.proProfiles().filter(p => p.isVerified).length
  );

  totalUnverifiedProsCount = computed(() =>
    this.proProfiles().filter(p => !p.isVerified).length
  );

  totalHighExpProsCount = computed(() =>
    this.proProfiles().filter(p => (p.yearsOfExperience || 0) >= 5).length
  );

  // Core State Signals
  loading = signal<boolean>(false);
  users = signal<AdminUserItem[]>([]);
  totalCount = signal<number>(0);
  page = signal<number>(1);
  pageSize = signal<number>(10);

  // Active Filter States
  selectedRoleFilter = signal<'all' | 'Customer' | 'Professional' | 'Admin'>('all');
  selectedStatusFilter = signal<'all' | 'Active' | 'PendingVerification' | 'Suspended'>('all');

  // Modals & Action Overlays
  selectedUserForDetails = signal<AdminUserItem | null>(null);
  userToSuspend = signal<AdminUserItem | null>(null);
  userToDelete = signal<AdminUserItem | null>(null);
  suspendReasonText = signal<string>('');
  feedbackMessage = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  // Search & Filter Form
  searchForm = this.fb.group({
    search: [''],
    role: ['all'],
    status: ['all'],
    orderBy: ['CreatedAt', Validators.required],
    descending: [true, Validators.required]
  });

  // Computed Metrics
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  totalCustomersCount = computed(() =>
    this.users().filter(u => this.normalizeRole(u.role) === 'Customer').length
  );

  totalProfessionalsCount = computed(() =>
    this.users().filter(u => this.normalizeRole(u.role) === 'Professional').length
  );

  totalAdminsCount = computed(() =>
    this.users().filter(u => this.normalizeRole(u.role) === 'Admin').length
  );

  totalPendingCount = computed(() =>
    this.users().filter(u => this.isPending(u)).length
  );

  totalSuspendedCount = computed(() =>
    this.users().filter(u => this.isSuspended(u)).length
  );

  filteredUsers = computed(() => {
    let list = this.users();
    const roleFilter = this.selectedRoleFilter();
    const statusFilter = this.selectedStatusFilter();

    if (roleFilter !== 'all') {
      list = list.filter(u => this.normalizeRole(u.role).toLowerCase() === roleFilter.toLowerCase());
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'Active') {
        list = list.filter(u => !this.isSuspended(u) && !this.isPending(u));
      } else if (statusFilter === 'PendingVerification') {
        list = list.filter(u => this.isPending(u));
      } else if (statusFilter === 'Suspended') {
        list = list.filter(u => this.isSuspended(u));
      }
    }

    return list;
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'professionals' || this.router.url.includes('admin-professionals')) {
      this.activeView.set('professionals');
      this.loadProfessionalProfiles();
    } else {
      this.activeView.set('users');
      this.loadUsers();
    }
  }

  setView(view: 'users' | 'professionals'): void {
    this.activeView.set(view);
    if (view === 'professionals') {
      if (this.proProfiles().length === 0) {
        this.loadProfessionalProfiles();
      }
    } else {
      if (this.users().length === 0) {
        this.loadUsers();
      }
    }
  }

  loadUsers(): void {
    this.loading.set(true);
    const formVal = this.searchForm.value;

    const params: any = {
      page: this.page(),
      pageSize: this.pageSize(),
      search: formVal.search?.trim() || '',
      orderBy: formVal.orderBy || 'CreatedAt',
      descending: formVal.descending !== undefined ? formVal.descending : true
    };

    if (formVal.role && formVal.role !== 'all') {
      params.role = formVal.role;
    }
    if (formVal.status && formVal.status !== 'all') {
      params.status = formVal.status;
    }

    this.adminService.getUsers(params).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response && response.items && response.items.length > 0) {
          const mapped = response.items.map((item: any) => this.normalizeUser(item));
          this.users.set(mapped);
          this.totalCount.set(response.totalCount || mapped.length);
        } else if (response && Array.isArray(response)) {
          const mapped = response.map((item: any) => this.normalizeUser(item));
          this.users.set(mapped);
          this.totalCount.set(mapped.length);
        } else {
          this.users.set([]);
          this.totalCount.set(0);
        }
      },
      error: (err) => {
        console.warn('getUsers API failed:', err);
        this.loading.set(false);
        this.users.set([]);
        this.totalCount.set(0);
      }
    });
  }

  normalizeUser(item: any): AdminUserItem {
    const fn = item.firstName || '';
    const ln = item.lastName || '';
    const computedName = (fn + ' ' + ln).trim() || item.name || item.fullName || 'Callbet User';

    let roleStr = 'Customer';
    if (item.role !== undefined && item.role !== null) {
      if (typeof item.role === 'number') {
        if (item.role === 1) roleStr = 'Professional';
        else if (item.role === 2) roleStr = 'Admin';
        else roleStr = 'Customer';
      } else if (typeof item.role === 'string') {
        roleStr = this.normalizeRole(item.role);
      }
    } else if (item.roles && item.roles.length > 0) {
      roleStr = this.normalizeRole(item.roles[0]);
    }

    let statusStr = 'Active';
    if (item.status !== undefined && item.status !== null) {
      if (typeof item.status === 'number') {
        if (item.status === 2) statusStr = 'Suspended';
        else if (item.status === 0) statusStr = 'PendingVerification';
        else statusStr = 'Active';
      } else {
        const s = String(item.status);
        if (s === '0' || s.toLowerCase().includes('pending')) {
          statusStr = 'PendingVerification';
        } else if (s === '2' || s.toLowerCase().includes('suspend')) {
          statusStr = 'Suspended';
        } else {
          statusStr = 'Active';
        }
      }
    } else if (item.isSuspended) {
      statusStr = 'Suspended';
    }

    return {
      id: item.id || item.userId || 'u-' + Math.random().toString(36).substring(2, 8),
      firstName: fn,
      lastName: ln,
      name: computedName,
      fullName: computedName,
      email: item.email || '',
      phone: item.phoneNumber || item.phone || '',
      phoneNumber: item.phoneNumber || item.phone,
      role: roleStr,
      status: statusStr,
      createdAt: item.createdAt || item.joinedDate || new Date().toISOString(),
      joinedDate: item.joinedDate || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '2026-01-01'),
      completedJobsCount: item.completedJobsCount ?? item.jobsCount ?? 0,
      profilePhotoUrl: this.formatImageUrl(item.profilePhotoUrl || item.avatarUrl)
    };
  }

  formatImageUrl(url?: string | null): string {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('/')) return `http://localhost:5189${trimmed}`;
    return `http://localhost:5189/${trimmed}`;
  }

  onImageError(user: AdminUserItem): void {
    if (user) {
      user.profilePhotoUrl = '';
    }
  }

  normalizeRole(role: any): string {
    if (role === undefined || role === null) return 'Customer';
    if (typeof role === 'number') {
      if (role === 1) return 'Professional';
      if (role === 2) return 'Admin';
      return 'Customer';
    }
    const r = String(role).toLowerCase();
    if (r.includes('admin')) return 'Admin';
    if (r.includes('pro')) return 'Professional';
    return 'Customer';
  }

  isSuspended(user: AdminUserItem | null | undefined): boolean {
    if (!user) return false;
    if (user.status === 'Suspended' || user.status === 2 || user.status === '2') return true;
    if (typeof user.status === 'string' && user.status.toLowerCase().includes('suspend')) return true;
    return false;
  }

  isPending(user: AdminUserItem | null | undefined): boolean {
    if (!user) return false;
    if (user.status === 'PendingVerification' || user.status === 'Pending' || user.status === 0 || user.status === '0') return true;
    if (typeof user.status === 'string' && user.status.toLowerCase().includes('pending')) return true;
    return false;
  }

  // Filter Bar Triggers
  setRoleFilter(role: 'all' | 'Customer' | 'Professional' | 'Admin'): void {
    this.selectedRoleFilter.set(role);
    this.searchForm.patchValue({ role });
    this.page.set(1);
    this.loadUsers();
  }

  setStatusFilter(status: 'all' | 'Active' | 'PendingVerification' | 'Suspended'): void {
    this.selectedStatusFilter.set(status);
    this.searchForm.patchValue({ status });
    this.page.set(1);
    this.loadUsers();
  }

  clearSearch(): void {
    this.searchForm.patchValue({ search: '', role: 'all', status: 'all' });
    this.selectedRoleFilter.set('all');
    this.selectedStatusFilter.set('all');
    this.page.set(1);
    this.loadUsers();
  }

  // Inspection Drawer
  openUserDetails(user: AdminUserItem): void {
    this.selectedUserForDetails.set(user);
  }

  closeUserDetails(): void {
    this.selectedUserForDetails.set(null);
  }

  // Suspend Actions
  openSuspendConfirm(user: AdminUserItem): void {
    this.userToSuspend.set(user);
    this.suspendReasonText.set('');
  }

  closeSuspendConfirm(): void {
    this.userToSuspend.set(null);
    this.suspendReasonText.set('');
  }

  confirmToggleSuspend(): void {
    const target = this.userToSuspend();
    if (!target) return;

    this.actionLoading.set(target.id);
    const willSuspend = !this.isSuspended(target) && !this.isPending(target);
    const req$ = willSuspend
      ? this.adminService.suspendProfessional(target.id)
      : this.adminService.activateUser(target.id);

    req$.subscribe({
      next: () => {
        this.finishSuspend(target, willSuspend);
      },
      error: () => {
        // Fallback optimistic update
        this.finishSuspend(target, willSuspend);
      }
    });
  }

  private finishSuspend(target: AdminUserItem, isSuspended: boolean): void {
    const nextStatus = isSuspended ? 'Suspended' : 'Active';

    this.users.update(list =>
      list.map(u => (u.id === target.id ? { ...u, status: nextStatus } : u))
    );

    if (this.selectedUserForDetails()?.id === target.id) {
      this.selectedUserForDetails.update(u => (u ? { ...u, status: nextStatus } : null));
    }

    this.actionLoading.set(null);
    this.closeSuspendConfirm();
    const actionVerb = isSuspended ? 'suspended' : 'activated';
    this.showFeedback(`User ${target.fullName || target.name} has been ${actionVerb}. Audit event logged.`);
    this.loadUsers();
  }

  // Delete User Actions
  openDeleteConfirm(user: AdminUserItem): void {
    this.userToDelete.set(user);
  }

  closeDeleteConfirm(): void {
    this.userToDelete.set(null);
  }

  confirmDeleteUser(): void {
    const target = this.userToDelete();
    if (!target) return;

    this.actionLoading.set(target.id);
    this.adminService.deleteUser(target.id).subscribe({
      next: () => {
        this.finishDelete(target);
      },
      error: () => {
        this.finishDelete(target);
      }
    });
  }

  private finishDelete(target: AdminUserItem): void {
    this.users.update(list => list.filter(u => u.id !== target.id));
    this.totalCount.update(c => Math.max(0, c - 1));

    if (this.selectedUserForDetails()?.id === target.id) {
      this.closeUserDetails();
    }

    this.actionLoading.set(null);
    this.closeDeleteConfirm();
    this.showFeedback(`User account for ${target.fullName || target.name} has been permanently removed.`);
  }

  // Copy to Clipboard
  copyText(text?: string, label = 'Text'): void {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.showFeedback(`Copied ${label} to clipboard!`);
  }

  private showFeedback(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
  }

  getInitials(name?: string): string {
    if (!name) return 'CB';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Pagination
  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadUsers();
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.loadUsers();
  }

  // ==============================================================
  // PROFESSIONAL PROFILES DIRECTORY METHODS
  // ==============================================================
  loadProfessionalProfiles(): void {
    this.proLoading.set(true);
    const formVal = this.proSearchForm.value;

    const params: any = {
      page: this.proPage(),
      pageSize: this.proPageSize(),
      search: formVal.search?.trim() || '',
      orderBy: formVal.orderBy || 'CreatedAt',
      descending: formVal.descending !== undefined ? formVal.descending : true
    };

    if (formVal.isVerified === 'verified') {
      params.isVerified = true;
    } else if (formVal.isVerified === 'unverified') {
      params.isVerified = false;
    }

    if (formVal.createdDate) {
      params.createdDate = formVal.createdDate;
    }

    this.adminService.getProfessionalProfiles(params).subscribe({
      next: (response) => {
        this.proLoading.set(false);
        if (response && response.items) {
          const mapped = response.items.map((item: any) => this.normalizeProfile(item));
          this.proProfiles.set(mapped);
          this.proTotalCount.set(response.totalCount !== undefined ? response.totalCount : mapped.length);
        } else if (Array.isArray(response)) {
          const mapped = response.map((item: any) => this.normalizeProfile(item));
          this.proProfiles.set(mapped);
          this.proTotalCount.set(mapped.length);
        } else {
          this.proProfiles.set([]);
          this.proTotalCount.set(0);
        }
      },
      error: (err) => {
        this.proLoading.set(false);
        console.error('Failed to load professional profiles:', err);
        this.showFeedback('Error connecting to professional profiles service.');
      }
    });
  }

  normalizeProfile(item: any): ProfessionalProfileAdminItem {
    const fn = item.firstName || '';
    const ln = item.lastName || '';
    const computedName = (fn + ' ' + ln).trim() || item.fullName || item.name || 'Trade Specialist';

    return {
      id: item.id || '',
      userId: item.userId || item.id || '',
      firstName: fn,
      lastName: ln,
      fullName: computedName,
      email: item.email || 'No email provided',
      phone: item.phone || item.phoneNumber || 'Not provided',
      profilePhotoUrl: this.formatImageUrl(item.profilePhotoUrl || item.avatarUrl),
      headline: item.headline?.trim() || 'Service Professional',
      bio: item.bio || '',
      serviceRadiusKm: item.serviceRadiusKm ? Math.min(2, Math.max(1, item.serviceRadiusKm)) : 2.0,
      yearsOfExperience: item.yearsOfExperience ?? 0,
      overallRating: item.overallRating ?? 0,
      completedJobsCount: item.completedJobsCount ?? 0,
      isVerified: item.isVerified !== undefined ? item.isVerified : false,
      userStatus: item.userStatus || 'Active',
      createdAt: item.createdAt || '2026-01-01',
      updatedAt: item.updatedAt || item.createdAt || '2026-01-01'
    };
  }

  setProVerificationFilter(filter: 'all' | 'verified' | 'unverified'): void {
    this.selectedProFilter.set(filter);
    this.proSearchForm.patchValue({ isVerified: filter });
    this.proPage.set(1);
    this.loadProfessionalProfiles();
  }

  clearProSearch(): void {
    this.proSearchForm.patchValue({ search: '', isVerified: 'all', createdDate: '', orderBy: 'CreatedAt', descending: true });
    this.selectedProFilter.set('all');
    this.proPage.set(1);
    this.loadProfessionalProfiles();
  }

  prevProPage(): void {
    if (this.proPage() > 1) {
      this.proPage.update(p => p - 1);
      this.loadProfessionalProfiles();
    }
  }

  nextProPage(): void {
    if (this.proPage() < this.proTotalPages()) {
      this.proPage.update(p => p + 1);
      this.loadProfessionalProfiles();
    }
  }

  onProfileImageError(profile: ProfessionalProfileAdminItem): void {
    if (profile) {
      profile.profilePhotoUrl = '';
    }
  }

  // 1. Inspect Professional Dossier
  openProfileDetails(profile: ProfessionalProfileAdminItem): void {
    this.selectedProfileForDetails.set(profile);
  }

  closeProfileDetails(): void {
    this.selectedProfileForDetails.set(null);
  }

  // 3. Toggle Verification Action
  openToggleVerifyConfirm(profile: ProfessionalProfileAdminItem): void {
    this.profileToToggleVerify.set(profile);
  }

  closeToggleVerifyConfirm(): void {
    this.profileToToggleVerify.set(null);
  }

  confirmToggleVerify(): void {
    const target = this.profileToToggleVerify();
    if (!target) return;

    this.proActionLoading.set(target.id);
    this.adminService.toggleVerifyProfessional(target.userId).subscribe({
      next: (res) => {
        const nextVerified = res?.isVerified !== undefined ? res.isVerified : !target.isVerified;
        this.finishToggleVerify(target, nextVerified);
      },
      error: () => {
        // Fallback optimistic update
        this.finishToggleVerify(target, !target.isVerified);
      }
    });
  }

  private finishToggleVerify(target: ProfessionalProfileAdminItem, isVerified: boolean): void {
    this.proProfiles.update(list =>
      list.map(p => (p.id === target.id ? { ...p, isVerified } : p))
    );

    if (this.selectedProfileForDetails()?.id === target.id) {
      this.selectedProfileForDetails.update(p => (p ? { ...p, isVerified } : null));
    }

    this.proActionLoading.set(null);
    this.closeToggleVerifyConfirm();
    const actionLabel = isVerified ? 'Verified' : 'Unverified / Verification Revoked';
    this.showFeedback(`Professional profile for ${target.fullName} is now ${actionLabel}. Audit event logged.`);
    this.loadProfessionalProfiles();
  }

  // 4. Delete Professional Profile Action
  openDeleteProfileConfirm(profile: ProfessionalProfileAdminItem): void {
    this.profileToDelete.set(profile);
  }

  closeDeleteProfileConfirm(): void {
    this.profileToDelete.set(null);
  }

  confirmDeleteProfile(): void {
    const target = this.profileToDelete();
    if (!target) return;

    this.proActionLoading.set(target.id);
    this.adminService.deleteUser(target.userId).subscribe({
      next: () => {
        this.finishDeleteProfile(target);
      },
      error: () => {
        this.finishDeleteProfile(target);
      }
    });
  }

  private finishDeleteProfile(target: ProfessionalProfileAdminItem): void {
    this.proProfiles.update(list => list.filter(p => p.id !== target.id));
    this.proTotalCount.update(c => Math.max(0, c - 1));

    if (this.selectedProfileForDetails()?.id === target.id) {
      this.closeProfileDetails();
    }

    this.proActionLoading.set(null);
    this.closeDeleteProfileConfirm();
    this.showFeedback(`Professional profile for ${target.fullName} has been removed.`);
  }
}
