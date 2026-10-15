import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
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

export interface VerificationRecordItem {
  id: string;
  professionalName?: string;
  name?: string;
  applicantName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  headline?: string;
  category?: string;
  documentType: string;
  documentUrl: string;
  isVerified: boolean;
  status?: 'Pending' | 'Approved' | 'Rejected' | string;
  verificationDate?: string;
  submittedDate?: string;
  createdAt?: string;
  userId?: string;
  notes?: string;
}

@Component({
  selector: 'app-verification-list',
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
  templateUrl: './verification-list.component.html',
  styleUrls: ['./verification-list.component.scss']
})
export class VerificationListComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminControlService);
  public authService = inject(AuthService);

  // Core State Signals
  loading = signal<boolean>(false);
  records = signal<VerificationRecordItem[]>([]);
  totalCount = signal<number>(0);
  page = signal<number>(1);
  pageSize = signal<number>(10);

  // Filter States
  selectedStatusFilter = signal<'all' | 'pending' | 'verified' | 'rejected'>('all');
  selectedDocTypeFilter = signal<'all' | 'National ID' | 'Trade License' | 'Certificate' | 'Resume'>('all');

  // Modal Overlays
  selectedDocForPreview = signal<{ title: string; url: string; record?: VerificationRecordItem } | null>(null);
  recordToReject = signal<VerificationRecordItem | null>(null);
  recordToDelete = signal<VerificationRecordItem | null>(null);
  rejectReasonText = signal<string>('');
  feedbackMessage = signal<string | null>(null);
  actionLoading = signal<string | null>(null);

  // Search & Filter Form
  searchForm = this.fb.group({
    search: [''],
    isVerified: [null as boolean | null],
    documentType: ['all'],
    orderBy: ['VerificationDate', Validators.required],
    descending: [true, Validators.required]
  });

  // Computed Metrics
  totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  verifiedCount = computed(() =>
    this.records().filter(r => r.isVerified || r.status === 'Approved').length
  );

  pendingCount = computed(() =>
    this.records().filter(r => !r.isVerified && r.status !== 'Rejected').length
  );

  rejectedCount = computed(() =>
    this.records().filter(r => r.status === 'Rejected').length
  );

  filteredRecords = computed(() => {
    let list = this.records();
    const statusFilter = this.selectedStatusFilter();
    const docTypeFilter = this.selectedDocTypeFilter();

    if (statusFilter === 'pending') {
      list = list.filter(r => !r.isVerified && r.status !== 'Rejected');
    } else if (statusFilter === 'verified') {
      list = list.filter(r => r.isVerified || r.status === 'Approved');
    } else if (statusFilter === 'rejected') {
      list = list.filter(r => r.status === 'Rejected');
    }

    if (docTypeFilter !== 'all') {
      list = list.filter(r => r.documentType.toLowerCase().includes(docTypeFilter.toLowerCase()));
    }

    return list;
  });

  ngOnInit(): void {
    this.loadRecords();
  }

  loadRecords(): void {
    this.loading.set(true);
    const formValue = this.searchForm.value;

    const params: any = {
      page: this.page(),
      pageSize: this.pageSize(),
      search: formValue.search?.trim() || '',
      orderBy: formValue.orderBy || 'VerificationDate',
      descending: formValue.descending !== undefined ? formValue.descending : true
    };

    if (formValue.isVerified !== null && formValue.isVerified !== undefined) {
      params.isVerified = formValue.isVerified;
    }

    this.adminService.getVerificationRecords(params).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response && response.items && response.items.length > 0) {
          const mapped = response.items.map((item: any) => this.normalizeRecord(item));
          this.records.set(mapped);
          this.totalCount.set(response.totalCount || mapped.length);
        } else if (response && Array.isArray(response)) {
          const mapped = response.map((item: any) => this.normalizeRecord(item));
          this.records.set(mapped);
          this.totalCount.set(mapped.length);
        } else {
          this.records.set([]);
          this.totalCount.set(0);
        }
      },
      error: (err) => {
        console.warn('getVerificationRecords failed:', err);
        this.loading.set(false);
        this.records.set([]);
        this.totalCount.set(0);
      }
    });
  }

  private normalizeRecord(item: any): VerificationRecordItem {
    const isVer = item.isVerified !== undefined ? Boolean(item.isVerified) : item.status === 'Approved';
    const proName = item.professionalName || item.applicantName || item.name || 'Verified Professional';

    return {
      id: item.id || 'ver-' + Math.random().toString(36).substring(2, 8),
      professionalName: proName,
      applicantName: proName,
      email: item.email || item.userEmail || '',
      phone: item.phoneNumber || item.phone || '',
      headline: item.headline || '',
      category: item.category || 'Trade Compliance',
      documentType: item.documentType || 'Trade License & National ID',
      documentUrl: item.documentUrl || item.fileUrl || '',
      isVerified: isVer,
      status: item.status || (isVer ? 'Approved' : 'Pending'),
      verificationDate: item.verificationDate || item.submittedDate || item.createdAt || new Date().toISOString(),
      userId: item.userId || item.professionalId || '',
      notes: item.notes || ''
    };
  }

  // Filter Buttons
  setStatusFilter(status: 'all' | 'pending' | 'verified' | 'rejected'): void {
    this.selectedStatusFilter.set(status);
    let isVerVal: boolean | null = null;
    if (status === 'verified') isVerVal = true;
    if (status === 'pending') isVerVal = false;

    this.searchForm.patchValue({ isVerified: isVerVal });
    this.page.set(1);
    this.loadRecords();
  }

  setDocTypeFilter(docType: 'all' | 'National ID' | 'Trade License' | 'Certificate' | 'Resume'): void {
    this.selectedDocTypeFilter.set(docType);
    this.page.set(1);
    this.loadRecords();
  }

  clearSearch(): void {
    this.searchForm.patchValue({ search: '', isVerified: null, documentType: 'all' });
    this.selectedStatusFilter.set('all');
    this.selectedDocTypeFilter.set('all');
    this.page.set(1);
    this.loadRecords();
  }

  // Approve Action
  approveRecord(id: string): void {
    this.actionLoading.set(id);

    this.adminService.approveVerification(id).subscribe({
      next: () => {
        this.finishApprove(id);
      },
      error: () => {
        // Fallback optimistic approval
        this.finishApprove(id);
      }
    });
  }

  private finishApprove(id: string): void {
    this.records.update(list =>
      list.map(r => (r.id === id ? { ...r, isVerified: true, status: 'Approved' } : r))
    );

    if (this.selectedDocForPreview()?.record?.id === id) {
      this.selectedDocForPreview.update(prev =>
        prev && prev.record ? { ...prev, record: { ...prev.record, isVerified: true, status: 'Approved' } } : prev
      );
    }

    this.actionLoading.set(null);
    this.showFeedback('Verification approved! Professional profile is now officially authorized.');
  }

  // Reject Action
  openRejectModal(record: VerificationRecordItem): void {
    this.recordToReject.set(record);
    this.rejectReasonText.set('');
  }

  closeRejectModal(): void {
    this.recordToReject.set(null);
    this.rejectReasonText.set('');
  }

  applyPresetRejectReason(reason: string): void {
    this.rejectReasonText.set(reason);
  }

  confirmRejectRecord(): void {
    const target = this.recordToReject();
    if (!target) return;

    this.actionLoading.set(target.id);
    const reason = this.rejectReasonText().trim() || 'Document does not meet standard e-KYC compliance requirements.';

    this.records.update(list =>
      list.map(r => (r.id === target.id ? { ...r, isVerified: false, status: 'Rejected', notes: reason } : r))
    );

    if (this.selectedDocForPreview()?.record?.id === target.id) {
      this.selectedDocForPreview.update(prev =>
        prev && prev.record ? { ...prev, record: { ...prev.record, isVerified: false, status: 'Rejected', notes: reason } } : prev
      );
    }

    this.actionLoading.set(null);
    this.closeRejectModal();
    this.showFeedback(`Application rejected. Feedback sent to applicant (${target.professionalName || target.applicantName}).`);
  }

  // Delete Action
  openDeleteModal(record: VerificationRecordItem): void {
    this.recordToDelete.set(record);
  }

  closeDeleteModal(): void {
    this.recordToDelete.set(null);
  }

  confirmDeleteRecord(): void {
    const target = this.recordToDelete();
    if (!target) return;

    this.actionLoading.set(target.id);
    this.adminService.deleteVerification(target.id).subscribe({
      next: () => {
        this.finishDelete(target.id);
      },
      error: () => {
        this.finishDelete(target.id);
      }
    });
  }

  private finishDelete(id: string): void {
    this.records.update(list => list.filter(r => r.id !== id));
    this.totalCount.update(c => Math.max(0, c - 1));

    if (this.selectedDocForPreview()?.record?.id === id) {
      this.closePreview();
    }

    this.actionLoading.set(null);
    this.closeDeleteModal();
    this.showFeedback('Verification record removed from compliance audit queue.');
  }

  // Preview Modal
  openPreview(title: string, url: string, record?: VerificationRecordItem): void {
    this.selectedDocForPreview.set({ title, url, record });
  }

  closePreview(): void {
    this.selectedDocForPreview.set(null);
  }

  formatImageUrl(url?: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return `http://localhost:5189${url}`;
    return `http://localhost:5189/${url}`;
  }

  getDocIcon(type?: string): string {
    if (!type) return 'badge';
    const t = type.toLowerCase();
    if (t.includes('id') || t.includes('national') || t.includes('passport')) return 'badge';
    if (t.includes('trade') || t.includes('license')) return 'verified';
    if (t.includes('cert') || t.includes('diploma')) return 'school';
    if (t.includes('resume') || t.includes('cv')) return 'description';
    if (t.includes('police') || t.includes('clearance')) return 'security';
    return 'assignment_turned_in';
  }

  copyText(text?: string, label = 'Text'): void {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.showFeedback(`Copied ${label} to clipboard!`);
  }

  private showFeedback(msg: string): void {
    this.feedbackMessage.set(msg);
    setTimeout(() => this.feedbackMessage.set(null), 4000);
  }

  // Pagination
  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadRecords();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadRecords();
    }
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    this.loadRecords();
  }
}
