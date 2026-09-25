import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminLogService, AdminLogDto } from '../core/services/admin-log.service';

@Component({
  selector: 'app-admin-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  templateUrl: './admin-logs.component.html',
  styleUrls: ['./admin-logs.component.scss']
})
export class AdminLogsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private logService = inject(AdminLogService);

  // State Signals
  logs = signal<AdminLogDto[]>([]);
  isLoading = signal(false);
  currentPage = signal(1);
  pageSize = signal(15);
  totalPages = signal(1);
  totalCount = signal(0);
  selectedFilter = signal<'all' | 'verification' | 'user' | 'dispute' | 'broadcast'>('all');

  // Search Form
  searchForm = this.fb.group({
    searchQuery: ['']
  });

  // Computed dynamic stats
  verificationLogsCount = computed(() =>
    this.logs().filter((l) => (l.targetEntity?.toLowerCase().includes('verification') || l.action.toLowerCase().includes('verification'))).length
  );
  userStatusLogsCount = computed(() =>
    this.logs().filter((l) => (l.targetEntity?.toLowerCase().includes('user') || l.action.toLowerCase().includes('user'))).length
  );

  ngOnInit(): void {
    this.loadLogs(1);
  }

  loadLogs(page = 1): void {
    this.isLoading.set(true);
    this.currentPage.set(page);

    const query = this.searchForm.value.searchQuery || '';
    const filter = this.selectedFilter();
    let effectiveSearch = query;

    if (filter !== 'all' && !query) {
      effectiveSearch = filter;
    }

    this.logService.getLogs(page, this.pageSize(), effectiveSearch).subscribe({
      next: (res) => {
        if (res && res.items) {
          this.logs.set(res.items);
          this.totalPages.set(res.totalPages || 1);
          this.totalCount.set(res.totalCount || 0);
        } else {
          this.logs.set([]);
          this.totalPages.set(1);
          this.totalCount.set(0);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load admin audit logs:', err);
        this.logs.set([]);
        this.isLoading.set(false);
      }
    });
  }

  onSearchSubmit(): void {
    this.loadLogs(1);
  }

  setFilter(filter: 'all' | 'verification' | 'user' | 'dispute' | 'broadcast'): void {
    this.selectedFilter.set(filter);
    if (filter === 'all') {
      this.searchForm.patchValue({ searchQuery: '' });
    } else {
      this.searchForm.patchValue({ searchQuery: filter });
    }
    this.loadLogs(1);
  }

  clearSearch(): void {
    this.searchForm.reset();
    this.selectedFilter.set('all');
    this.loadLogs(1);
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
}
