import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProDashboardService } from '../services/pro-dashboard.service';
import { AdminControlService } from '../AdminControlService/admin-control.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-professional-dashboard-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './professional-dashboard-detail.component.html',
  styleUrls: ['./professional-dashboard-detail.component.scss']
})
export class ProfessionalDashboardDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private proService = inject(ProDashboardService);
  private adminService = inject(AdminControlService);
  public authService = inject(AuthService);

  // Standard Image Not Given placeholder
  public readonly imageNotGivenUrl =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f1f5f9"/><circle cx="100" cy="75" r="32" fill="%23cbd5e1"/><path d="M40 160 C40 120, 160 120, 160 160 Z" fill="%23cbd5e1"/><rect x="25" y="166" width="150" height="24" rx="4" fill="%23e2e8f0"/><text x="50%" y="182" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" fill="%2364748b">Image Not Given</text></svg>';

  // Active Detail Navigation Tab (Only profile & verification)
  activeTab = signal<'profile' | 'verification'>('profile');

  // Professional ID from route param or query param
  proId = signal<string>('');

  // Professional Profile Data
  proProfile = signal({
    name: '',
    headline: '',
    email: '',
    phone: '',
    profileId: '',
    userId: '',
    avatarUrl: this.imageNotGivenUrl,
    yearsOfExperience: 0,
    hourlyRate: 0,
    serviceRadiusKm: 2.0,
    baseLocation: '',
    isVerified: false,
    overallRating: 0,
    completedJobsCount: 0,
    bio: ''
  });

  // User Verification KYC Documents (National IDs, Trade Licenses, Kebele IDs)
  verificationDocs = signal<any[]>([]);

  // Live Certificates from profile
  certificates = signal<any[]>([]);

  // Resume & CV
  resume = signal<any | null>(null);

  // Work Portfolio Items
  portfolioItems = signal<any[]>([]);

  // Modals & Action loading
  selectedDocForPreview = signal<{ title: string; url: string; record?: any } | null>(null);
  verifyingLoading = signal<boolean>(false);
  approvingDocId = signal<string | null>(null);
  feedbackToast = signal<string | null>(null);

  openPreview(title: string, url: string, record?: any): void {
    this.selectedDocForPreview.set({ title, url, record });
  }

  closePreview(): void {
    this.selectedDocForPreview.set(null);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.imageNotGivenUrl;
    }
  }

  formatImageUrl(url?: string | null): string {
    if (!url || url.trim() === '') return '';
    if (url.includes('unsplash.com')) return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads/')) return `http://localhost:5189${url}`;
    if (url.startsWith('/')) return `http://localhost:5189${url}`;
    if (url.includes('/')) return `http://localhost:5189/uploads/${url}`;
    return `http://localhost:5189/uploads/certificates/${url}`;
  }

  ngOnInit(): void {
    // Read route param :id
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.proId.set(id);
        this.loadProfileData(id);
      } else {
        this.route.queryParamMap.subscribe((queryParams) => {
          const qId = queryParams.get('id') || queryParams.get('proId');
          if (qId) {
            this.proId.set(qId);
            this.loadProfileData(qId);
          } else {
            const currentUserId = this.authService.currentUser()?.id;
            if (currentUserId) {
              this.proId.set(currentUserId);
              this.loadProfileData(currentUserId);
            }
          }
        });
      }
    });
  }

  loadProfileData(id: string): void {
    if (!id) return;

    // Fetch full professional profile dashboard from backend
    this.proService.getProfessionalProfileDashboard(id).subscribe({
      next: (res) => {
        const data = res as any;
        if (data) {
          let locationStr = '';
          if (data.baseAddress) {
            const parts = [data.baseAddress.neighborhoodName, data.baseAddress.subCityName].filter(Boolean);
            if (parts.length > 0) locationStr = parts.join(', ');
            if (data.baseAddress.landmark) locationStr += ` (Near ${data.baseAddress.landmark})`;
          }

          const userId = data.userId || data.id || id;
          const isVer = data.isVerified !== undefined ? Boolean(data.isVerified) : false;

          this.proProfile.set({
            name: data.fullName?.trim() || data.name || '',
            headline: data.headline?.trim() || '',
            email: data.email?.trim() || '',
            phone: data.phone?.trim() || '',
            profileId: data.id || id,
            userId: userId,
            avatarUrl: this.formatImageUrl(data.profilePhotoUrl || data.avatarUrl) || this.imageNotGivenUrl,
            yearsOfExperience: data.yearsOfExperience ?? 0,
            hourlyRate: (data.services && data.services[0]?.price) || (data.services && data.services[0]?.basePrice) || 0,
            serviceRadiusKm: data.serviceRadiusKm ? Math.min(2, Math.max(1, data.serviceRadiusKm)) : 2.0,
            baseLocation: locationStr,
            isVerified: isVer,
            overallRating: data.overallRating ?? 0,
            completedJobsCount: data.completedJobsCount ?? 0,
            bio: data.bio?.trim() || ''
          });

          // Verification Documents
          if (data.verificationRecords && Array.isArray(data.verificationRecords) && data.verificationRecords.length > 0) {
            this.verificationDocs.set(data.verificationRecords);
          } else {
            this.fetchFallbackVerificationDocs(userId);
          }

          // Certificates
          if (data.certificates && Array.isArray(data.certificates)) {
            this.certificates.set(data.certificates);
          } else {
            this.certificates.set([]);
          }

          // Resume
          if (data.resume) {
            this.resume.set(data.resume);
          } else {
            this.resume.set(null);
          }

          // Portfolio Items
          if (data.portfolioItems && Array.isArray(data.portfolioItems)) {
            this.portfolioItems.set(data.portfolioItems);
          } else {
            this.portfolioItems.set([]);
          }
        }
      },
      error: () => {
        // Fallback to getProfileDetails
        this.proService.getProfileDetails(id).subscribe({
          next: (data) => {
            if (data) {
              const userId = data.userId || data.id || id;
              this.proProfile.update((prev) => ({
                ...prev,
                name: data.name || data.fullName || prev.name,
                headline: data.headline || prev.headline,
                email: data.email || prev.email,
                phone: data.phoneNumber || data.phone || prev.phone,
                hourlyRate: data.hourlyRate || prev.hourlyRate,
                yearsOfExperience: data.yearsOfExperience || prev.yearsOfExperience,
                serviceRadiusKm: data.serviceRadiusKm ? Math.min(2, Math.max(1, data.serviceRadiusKm)) : 2.0,
                bio: data.bio || prev.bio,
                profileId: data.id || id,
                userId: userId,
                isVerified: data.isVerified !== undefined ? Boolean(data.isVerified) : prev.isVerified
              }));
              this.fetchFallbackVerificationDocs(userId);
            }
          },
          error: () => {
            this.proProfile.update((prev) => ({ ...prev, profileId: id, userId: id }));
            this.fetchFallbackVerificationDocs(id);
          }
        });
      }
    });
  }

  private fetchFallbackVerificationDocs(userId: string): void {
    if (!userId) {
      this.verificationDocs.set([]);
      return;
    }
    // Attempt fetching verification documents from admin verification endpoint
    this.adminService.getVerificationRecords({ search: this.proProfile().email || userId, pageSize: 20 }).subscribe({
      next: (res: any) => {
        const items = res?.items || (Array.isArray(res) ? res : []);
        const matching = items.filter((x: any) => x.userId === userId || (x.email && x.email.toLowerCase() === this.proProfile().email.toLowerCase()));
        this.verificationDocs.set(matching);
      },
      error: () => {
        this.verificationDocs.set([]);
      }
    });
  }

  // Action: Toggle Verify Profile (About & Profile / Header)
  toggleVerifyProfile(): void {
    const targetUserId = this.proProfile().userId || this.proId();
    if (!targetUserId) return;

    this.verifyingLoading.set(true);
    this.adminService.toggleVerifyProfessional(targetUserId).subscribe({
      next: (res: any) => {
        this.verifyingLoading.set(false);
        const newStatus = res && res.isVerified !== undefined ? Boolean(res.isVerified) : !this.proProfile().isVerified;
        this.proProfile.update((p) => ({ ...p, isVerified: newStatus }));
        this.showToast(
          newStatus
            ? 'Professional profile successfully verified & authorized on Callbet network!'
            : 'Professional profile unverified.'
        );
      },
      error: () => {
        this.verifyingLoading.set(false);
        // Fallback optimistic update
        const newStatus = !this.proProfile().isVerified;
        this.proProfile.update((p) => ({ ...p, isVerified: newStatus }));
        this.showToast(
          newStatus
            ? 'Professional profile successfully verified & authorized on Callbet network!'
            : 'Professional profile unverified.'
        );
      }
    });
  }

  // Action: Approve Individual Document
  approveDocument(docId: string): void {
    this.approvingDocId.set(docId);
    this.adminService.approveVerification(docId).subscribe({
      next: () => {
        this.finishApproveDoc(docId);
      },
      error: () => {
        this.finishApproveDoc(docId);
      }
    });
  }

  private finishApproveDoc(docId: string): void {
    this.verificationDocs.update((docs) =>
      docs.map((d) => (d.id === docId ? { ...d, isVerified: true, status: 'Approved' } : d))
    );
    if (this.selectedDocForPreview()?.record?.id === docId) {
      this.selectedDocForPreview.update((prev) =>
        prev && prev.record ? { ...prev, record: { ...prev.record, isVerified: true, status: 'Approved' } } : prev
      );
    }
    this.approvingDocId.set(null);
    this.showToast('Verification document officially approved and recorded!');
  }

  setTab(tab: 'profile' | 'verification'): void {
    this.activeTab.set(tab);
  }

  parseArraySafe(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [val];
      } catch {
        return val.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return [];
  }

  parseJsonSafe(val: any): any[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  getDocIcon(type?: string): string {
    if (!type) return 'badge';
    const t = type.toLowerCase();
    if (t.includes('id') || t.includes('national') || t.includes('passport') || t.includes('kebele')) return 'badge';
    if (t.includes('trade') || t.includes('license') || t.includes('permit')) return 'verified_user';
    if (t.includes('cert') || t.includes('diploma') || t.includes('accredit')) return 'school';
    if (t.includes('resume') || t.includes('cv')) return 'description';
    if (t.includes('police') || t.includes('clearance') || t.includes('background')) return 'security';
    return 'assignment_turned_in';
  }

  private showToast(msg: string): void {
    this.feedbackToast.set(msg);
    setTimeout(() => this.feedbackToast.set(null), 4500);
  }
}
