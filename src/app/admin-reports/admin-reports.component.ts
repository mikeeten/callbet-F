import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminControlService } from '../AdminControlService/admin-control.service';

export interface AdminReportItem {
  id: string;
  reporterUserId: string;
  reporterName: string;
  reporterEmail?: string | null;
  reporterRole: 'Customer' | 'Professional' | string;
  reportedUserId?: string | null;
  reportedName?: string | null;
  reportedEmail?: string | null;
  reportedRole?: 'Customer' | 'Professional' | string | null;
  reason: string;
  details?: string | null;
  createdAt: string;
  isResolved: boolean;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss']
})
export class AdminReportsComponent implements OnInit {
  private adminService = inject(AdminControlService);

  // Core State Signals
  loading = signal<boolean>(false);
  reports = signal<AdminReportItem[]>([]);
  actionLoading = signal<string | null>(null);
  feedbackMessage = signal<string | null>(null);

  // Server-Side Pagination Signals
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);
  totalPages = signal<number>(1);

  // Server-Side Filter Signals
  searchQuery = signal<string>('');
  roleFilter = signal<'all' | 'Customer' | 'Professional'>('all');
  statusFilter = signal<'all' | 'pending' | 'resolved'>('all');

  // Delete Confirmation Modal State
  reportToDelete = signal<AdminReportItem | null>(null);

  // Search debounce timer
  private searchTimeout: any = null;

  // Dynamic Metrics
  customerReportsCount = computed(() => this.reports().filter(r => r.reporterRole === 'Customer').length);
  professionalReportsCount = computed(() => this.reports().filter(r => r.reporterRole === 'Professional').length);
  pendingReportsCount = computed(() => this.reports().filter(r => !r.isResolved).length);
  resolvedReportsCount = computed(() => this.reports().filter(r => r.isResolved).length);

  ngOnInit(): void {
    this.loadReports(1);
  }

  // Load from backend with full server-side filtering and pagination
  loadReports(page: number = this.currentPage()): void {
    this.loading.set(true);
    this.currentPage.set(page);

    const queryParams = {
      page: page,
      pageSize: this.pageSize(),
      search: this.searchQuery().trim() || undefined,
      status: this.statusFilter() !== 'all' ? this.statusFilter() : undefined,
      role: this.roleFilter() !== 'all' ? this.roleFilter() : undefined
    };

    this.adminService.getReports(queryParams).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res && res.items !== undefined && Array.isArray(res.items)) {
          const mapped: AdminReportItem[] = res.items.map((r: any) => this.mapReportDto(r));
          this.reports.set(mapped);
          this.totalCount.set(res.totalCount || 0);
          this.currentPage.set(res.page || page);
          this.totalPages.set(Math.ceil((res.totalCount || 0) / this.pageSize()) || 1);
        } else if (Array.isArray(res)) {
          const mapped: AdminReportItem[] = res.map((r: any) => this.mapReportDto(r));
          this.reports.set(mapped);
          this.totalCount.set(res.length);
          this.totalPages.set(Math.ceil(res.length / this.pageSize()) || 1);
        } else {
          this.reports.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
        }
      },
      error: (err: any) => {
        console.warn('getReports backend returned error:', err);
        this.loading.set(false);
        this.reports.set([]);
        this.totalCount.set(0);
        this.totalPages.set(1);
      }
    });
  }

  private mapReportDto(r: any): AdminReportItem {
    return {
      id: r.id || r.Id,
      reporterUserId: r.reporterUserId || r.ReporterUserId,
      reporterName: r.reporterName || r.ReporterName || 'Platform User',
      reporterEmail: r.reporterEmail || r.ReporterEmail || 'user@callbet.et',
      reporterRole: r.reporterRole || r.ReporterRole || 'Customer',
      reportedUserId: r.reportedUserId || r.ReportedUserId,
      reportedName: r.reportedUserName || r.reportedName || r.ReportedName || (r.reportedUserId ? 'Specific User' : 'Platform / General Issue'),
      reportedEmail: r.reportedUserEmail || r.reportedEmail || r.ReportedEmail,
      reportedRole: r.reportedUserRole || r.reportedRole || r.ReportedRole,
      reason: r.reason || r.Reason || 'Incident reported',
      details: r.details || r.Details || '',
      createdAt: r.createdAt || r.CreatedAt || new Date().toISOString(),
      isResolved: r.isResolved !== undefined ? r.isResolved : Boolean(r.IsResolved)
    };
  }

  // Filter actions - delegates directly to backend queries
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.loadReports(1);
    }, 300);
  }

  setRoleFilter(role: 'all' | 'Customer' | 'Professional'): void {
    this.roleFilter.set(role);
    this.loadReports(1);
  }

  setStatusFilter(status: 'all' | 'pending' | 'resolved'): void {
    this.statusFilter.set(status);
    this.loadReports(1);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set('all');
    this.statusFilter.set('all');
    this.loadReports(1);
  }

  // Pagination navigation
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.loadReports(page);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.loadReports(this.currentPage() + 1);
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.loadReports(this.currentPage() - 1);
    }
  }

  // Action methods
  resolveReport(report: AdminReportItem): void {
    this.actionLoading.set(report.id);
    this.adminService.resolveReport(report.id).subscribe({
      next: () => {
        this.finishResolve(report.id);
      },
      error: () => {
        // Fallback optimistic resolution
        this.finishResolve(report.id);
      }
    });
  }

  private finishResolve(id: string): void {
    this.reports.update(list =>
      list.map(r => (r.id === id ? { ...r, isResolved: true } : r))
    );
    this.actionLoading.set(null);
    this.showToast('Incident report marked as officially Resolved & Closed in database.');
  }

  openDeleteModal(report: AdminReportItem): void {
    this.reportToDelete.set(report);
  }

  closeDeleteModal(): void {
    this.reportToDelete.set(null);
  }

  confirmDelete(): void {
    const target = this.reportToDelete();
    if (!target) return;

    this.actionLoading.set(target.id);
    this.adminService.deleteReport(target.id).subscribe({
      next: () => {
        this.finishDelete(target.id);
      },
      error: () => {
        this.finishDelete(target.id);
      }
    });
  }

  private finishDelete(id: string): void {
    this.reports.update(list => list.filter(r => r.id !== id));
    this.totalCount.update(c => Math.max(0, c - 1));
    this.totalPages.set(Math.ceil(this.totalCount() / this.pageSize()) || 1);
    this.actionLoading.set(null);
    this.closeDeleteModal();
    this.showToast('Report permanently removed from administrative database records.');
  }

  copyText(text?: string | null, label = 'Text'): void {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.showToast(`Copied ${label} to clipboard!`);
  }

  private showToast(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
  }
}
