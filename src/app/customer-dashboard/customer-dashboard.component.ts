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
import { JobService } from '../services/job.service';
import { NotificationService } from '../services/notification.service';
import { CustomerServicesService } from '../services/customer-services.service';
import { AuthService } from '../core/services/auth.service';
import { LocationService, Address } from '../services/location.service';
import { AddressPickerComponent } from '../components/address-picker/address-picker.component';
import { MapModalComponent } from '../components/map-modal/map-modal.component';
import { ChatService } from '../services/chat.service';
import { CustomerBookedServicesComponent } from '../customer-booked-services/customer-booked-services.component';

export interface CustomerJob {
  id: string;
  serviceName: string;
  professionalName: string;
  professionalId: string;
  status: 'Draft' | 'Assigned' | 'InProgress' | 'CompletedPendingApproval' | 'Closed' | 'Cancelled';
  price: number;
  scheduledDate: string;
  address: string;
  description: string;
  hasReview: boolean;
}

export interface CustomerAddress {
  id: string;
  label: string;
  subCity: string;
  neighborhood: string;
  houseNo: string;
  isDefault: boolean;
}

export interface CustomerPayment {
  id: string;
  jobId: string;
  serviceName: string;
  amount: number;
  status: 'Held in Escrow' | 'Released' | 'Pending Refund';
  date: string;
  transactionId: string;
}

export interface CustomerReview {
  id: string;
  jobId: string;
  professionalName: string;
  serviceName: string;
  rating: number;
  comment: string;
  date: string;
  reply?: {
    comment: string;
    date: string;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'professional';
  text: string;
  time: string;
}

@Component({
  selector: 'app-customer-dashboard',
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
  templateUrl: './customer-dashboard.component.html',
  styleUrls: ['./customer-dashboard.component.scss']
})
export class CustomerDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private jobService = inject(JobService);
  public notificationService = inject(NotificationService);
  private customerServicesService = inject(CustomerServicesService);
  public authService = inject(AuthService);
  public locationService = inject(LocationService);
  public chatService = inject(ChatService);

  // Active Route Customer ID
  routeCustomerId = signal<string | null>(null);

  // Active Navigation Tab (Includes favorites)
  activeTab = signal<'profile' | 'favorites' | 'payments' | 'reviews' | 'chats' | 'oversight'>('profile');

  // Favorites / Bookmarks State
  favoriteSubTab = signal<'services' | 'professionals'>('services');
  favoriteServices = signal<any[]>([]);
  favoriteProfessionals = signal<any[]>([]);
  favoritesLoading = signal(false);

  // Signout Confirmation Modal State
  showSignoutConfirm = signal(false);

  // Map Modal State
  activeMapModalAddress = signal<Address | null>(null);

  openAddressMap(addr: Address): void {
    this.activeMapModalAddress.set(addr);
  }

  closeAddressMap(): void {
    this.activeMapModalAddress.set(null);
  }

  // Customer Profile State
  customerProfile = signal({
    name: '',
    email: '',
    phone: '',
    userId: '',
    avatarUrl: '',
    isVerified: false,
    joinedDate: ''
  });

  // Saved Addresses State
  addresses = signal<CustomerAddress[]>([]);
  showAddAddress = signal(false);

  // Jobs State
  jobs = signal<CustomerJob[]>([]);
  jobStatusFilter = signal<'all' | 'pending' | 'in_progress' | 'completed' | 'closed'>('all');
  selectedJobForReview = signal<CustomerJob | null>(null);

  // Payments State
  payments = signal<CustomerPayment[]>([]);

  // Reviews State
  reviews = signal<CustomerReview[]>([]);
  reviewsLoading = signal(false);

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

  selectChatSession(session: any): void {
    this.chatService.selectSession(session.id);
  }

  onTyping(): void {
    this.chatService.sendTyping(true);
  }

  isMyMessage(msg: any): boolean {
    const currentUserId = this.customerProfile().userId || this.authService.currentUser()?.id;
    return msg.senderRole === 'Customer' || msg.senderId === currentUserId;
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

  // Admin Oversight Records
  oversightLogs = signal<any[]>([]);

  // Reactive Forms
  addressForm = this.fb.group({
    label: ['', Validators.required],
    subCity: ['Bole', Validators.required],
    neighborhood: ['', Validators.required],
    houseNo: ['', Validators.required],
    isDefault: [false]
  });

  reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.maxLength(500)]]
  });

  // Profile Edit & Photo Upload State
  isUploadingPhoto = signal<boolean>(false);
  showEditProfileModal = signal<boolean>(false);
  profileEditForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phone: ['']
  });

  // Action States
  actionLoading = signal<string | null>(null);
  feedbackMessage = signal<string | null>(null);
  selectedReceipt = signal<CustomerPayment | null>(null);

  // Filtered Jobs
  filteredJobs = computed(() => {
    const list = this.jobs();
    const filter = this.jobStatusFilter();
    if (filter === 'pending') return list.filter((j) => j.status === 'Draft' || j.status === 'Assigned');
    if (filter === 'in_progress') return list.filter((j) => j.status === 'InProgress');
    if (filter === 'completed') return list.filter((j) => j.status === 'CompletedPendingApproval');
    if (filter === 'closed') return list.filter((j) => j.status === 'Closed');
    return list;
  });

  // Escrow Metrics
  totalHeldInEscrow = computed(() =>
    this.payments()
      .filter((p) => p.status === 'Held in Escrow')
      .reduce((sum, p) => sum + p.amount, 0)
  );

  totalReleased = computed(() =>
    this.payments()
      .filter((p) => p.status === 'Released')
      .reduce((sum, p) => sum + p.amount, 0)
  );

  ngOnInit(): void {
    // Role-based security check: block Professionals from accessing Customer Dashboard
    const authUser = this.authService.currentUser();
    if (authUser && !this.authService.hasAnyRole(['Customer', 'Admin'])) {
      this.router.navigate(['/unauthorized']);
      return;
    }

    // 1. Initial customer identification from route or query params
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.routeCustomerId.set(id);
        this.customerProfile.update((prof) => ({ ...prof, userId: id }));
      }
    });

    this.route.queryParamMap.subscribe((queryParams) => {
      const qId = queryParams.get('id') || queryParams.get('customerId');
      if (qId && !this.routeCustomerId()) {
        this.routeCustomerId.set(qId);
        this.customerProfile.update((prof) => ({ ...prof, userId: qId }));
      }
    });

    // 2. Fetch authenticated customer's own profile and data using Bearer Token
    this.loadCustomerProfile();
    this.locationService.loadSubCities().subscribe();
    this.locationService.loadMyAddresses().subscribe();
    this.chatService.loadMySessions().subscribe();
    this.notificationService.loadNotifications();
  }

  loadCustomerProfile(): void {
    // Pre-fill from current auth session
    const authUser = this.authService.currentUser();
    if (authUser) {
      this.customerProfile.update((prev) => ({
        ...prev,
        userId: authUser.id || prev.userId,
        email: authUser.email || prev.email,
        name: (authUser.firstName || authUser.lastName)
          ? `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim()
          : prev.name
      }));
    }

    // Call GET /api/customer/profile with JWT Bearer token
    this.customerServicesService.getCustomerProfile().subscribe({
      next: (profile) => {
        if (profile) {
          const fullName =
            profile.fullName ||
            (profile.firstName || profile.lastName
              ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
              : profile.name) ||
            this.customerProfile().name;

          this.customerProfile.update((prev) => ({
            ...prev,
            name: fullName,
            email: profile.email || prev.email,
            phone: profile.phoneNumber || profile.phone || prev.phone,
            userId: profile.id || profile.userId || prev.userId,
            avatarUrl: profile.profilePhotoUrl || profile.avatarUrl || prev.avatarUrl,
            isVerified: profile.isVerified !== undefined ? profile.isVerified : prev.isVerified,
            joinedDate: profile.createdAt
              ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : prev.joinedDate
          }));

          if (profile.addresses && Array.isArray(profile.addresses) && profile.addresses.length > 0) {
            this.addresses.set(
              profile.addresses.map((a: any) => ({
                id: a.id || 'addr-' + Math.random(),
                label: a.label || a.addressType || 'Address',
                subCity: a.subCity || 'Bole',
                neighborhood: a.neighborhood || a.street || '',
                houseNo: a.houseNo || a.houseNumber || '',
                isDefault: !!a.isDefault
              }))
            );
          }

          const targetId = profile.id || profile.userId || this.customerProfile().userId;
          this.loadFavorites(targetId);
          this.loadReviews(targetId);
        } else {
          this.loadFavorites(this.customerProfile().userId);
          this.loadReviews(this.customerProfile().userId);
        }
      },
      error: (err: any) => {
        console.warn('GET /api/customer/profile notice:', err?.message || err);
        this.loadFavorites(this.customerProfile().userId);
        this.loadReviews(this.customerProfile().userId);
      }
    });
  }

  loadReviews(targetCustomerId?: string): void {
    const custId = targetCustomerId || this.customerProfile().userId;
    this.reviewsLoading.set(true);

    this.customerServicesService.getReviews(custId).subscribe({
      next: (data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          this.reviews.set(
            data.map((r: any) => ({
              id: r.id || 'rev-' + Math.random(),
              jobId: r.jobId || '',
              professionalName: r.professionalName || r.technicianName || 'Verified Professional',
              serviceName: r.serviceName || r.serviceTitle || 'Professional Service',
              rating: r.rating || 5,
              comment: r.comment || r.feedback || '',
              date: r.createdAt
                ? new Date(r.createdAt).toISOString().split('T')[0]
                : (r.date || new Date().toISOString().split('T')[0]),
              reply: r.reply
                ? {
                    comment: r.reply.comment || r.reply.message || '',
                    date: r.reply.createdAt
                      ? new Date(r.reply.createdAt).toISOString().split('T')[0]
                      : (r.reply.date || '')
                  }
                : undefined
            }))
          );
        }
        this.reviewsLoading.set(false);
      },
      error: (err: any) => {
        console.warn('GET /api/customer/reviews notice:', err?.message || err);
        this.reviewsLoading.set(false);
      }
    });
  }

  loadFavorites(targetCustomerId?: string): void {
    const custId = targetCustomerId || this.customerProfile().userId;
    this.favoritesLoading.set(true);

    // 1. Fetch Favorite Professionals via GET /api/customer/favorite-professionals
    this.customerServicesService.getFavoriteProfessionals(custId).subscribe({
      next: (pros) => {
        if (pros && Array.isArray(pros)) {
          this.favoriteProfessionals.set(
            pros.map((p: any) => ({
              id: p.id || p.professionalProfileId || 'pro-' + Math.random(),
              professionalProfileId: p.professionalProfileId || p.id || p.userId,
              name: p.professionalName || p.name || p.fullName || 'Verified Professional',
              headline: p.professionalHeadline || p.headline || 'Licensed Trade Specialist',
              avatarUrl: p.profilePhotoUrl || p.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
              rating: p.overallRating || p.rating || 5.0,
              completedJobsCount: p.completedJobsCount || p.completedJobs || 0,
              hourlyRate: p.hourlyRate || p.basePrice || p.customPrice || 120,
              isVerified: p.isVerified ?? true,
              serviceRadiusKm: p.serviceRadiusKm ? Math.min(2.5, Math.max(1, p.serviceRadiusKm)) : 2.5,
              location: p.location || p.city || 'Addis Ababa'
            }))
          );
        } else {
          this.favoriteProfessionals.set([]);
        }
      },
      error: (err: any) => {
        console.warn('GET /api/customer/favorite-professionals notice:', err?.message || err);
        this.favoriteProfessionals.set([]);
      }
    });

    // 2. Fetch Favorite Services via GET /api/customer/favorite-services
    this.customerServicesService.getFavoriteServices(custId).subscribe({
      next: (services) => {
        if (services && Array.isArray(services)) {
          this.favoriteServices.set(
            services.map((s: any) => ({
              id: s.id || s.serviceId || 'srv-' + Math.random(),
              serviceId: s.serviceId || s.id,
              serviceName: s.serviceName || s.name,
              categoryName: s.categoryName || 'General Trade',
              price: s.effectivePrice || s.basePrice || s.price || 100,
              pricingType: s.pricingType === 1 ? 'Hourly Rate' : 'Fixed Price',
              professionalName: s.professionalName || s.providerName || 'Verified Technician',
              professionalProfileId: s.professionalProfileId || s.userId,
              rating: s.overallRating || s.rating || 5.0,
              description: s.serviceDescription || s.description || 'Professional trade service offering.'
            }))
          );
        } else {
          this.favoriteServices.set([]);
        }
        this.favoritesLoading.set(false);
      },
      error: (err: any) => {
        console.warn('GET /api/customer/favorite-services notice:', err?.message || err);
        this.favoriteServices.set([]);
        this.favoritesLoading.set(false);
      }
    });
  }

  setTab(tab: 'profile' | 'favorites' | 'payments' | 'reviews' | 'chats' | 'oversight'): void {
    this.activeTab.set(tab);
    this.feedbackMessage.set(null);
    if (tab === 'favorites') {
      this.loadFavorites();
    }
    if (tab === 'reviews') {
      this.loadReviews();
    }
  }

  navigateToBookedServices(): void {
    this.router.navigate(['/customer-booked-services']);
  }

  setFavoriteSubTab(subTab: 'services' | 'professionals'): void {
    this.favoriteSubTab.set(subTab);
  }

  removeFavoriteService(serviceId: string): void {
    const custId = this.customerProfile().userId;
    this.customerServicesService.removeFavoriteService(serviceId, custId).subscribe({
      next: () => {
        this.favoriteServices.update((list) => list.filter((s) => s.serviceId !== serviceId && s.id !== serviceId));
        this.feedbackMessage.set('Service removed from your favorites.');
      },
      error: () => {
        // Optimistic UI update
        this.favoriteServices.update((list) => list.filter((s) => s.serviceId !== serviceId && s.id !== serviceId));
        this.feedbackMessage.set('Service removed from your favorites.');
      }
    });
  }

  removeFavoriteProfessional(proProfileId: string): void {
    const custId = this.customerProfile().userId;
    this.customerServicesService.removeFavoriteProfessional(proProfileId, custId).subscribe({
      next: () => {
        this.favoriteProfessionals.update((list) => list.filter((p) => p.professionalProfileId !== proProfileId && p.id !== proProfileId));
        this.feedbackMessage.set('Professional removed from your favorites.');
      },
      error: () => {
        // Optimistic UI update
        this.favoriteProfessionals.update((list) => list.filter((p) => p.professionalProfileId !== proProfileId && p.id !== proProfileId));
        this.feedbackMessage.set('Professional removed from your favorites.');
      }
    });
  }

  // ==========================================
  // PROFILE EDIT & PHOTO UPLOAD ACTIONS
  // ==========================================

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Client-side validation: Max 5MB & Supported Image formats
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.feedbackMessage.set('Please select a valid image file (.jpg, .png, .webp, .gif).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.feedbackMessage.set('Image file size must not exceed 5MB.');
      return;
    }

    this.isUploadingPhoto.set(true);
    this.customerServicesService.uploadProfilePhoto(file).subscribe({
      next: (res) => {
        this.isUploadingPhoto.set(false);
        const newUrl = res.profilePhotoUrl || (res.profile && res.profile.profilePhotoUrl);
        if (newUrl) {
          this.customerProfile.update((prev) => ({
            ...prev,
            avatarUrl: newUrl
          }));
          this.authService.updateUserProfile({ profilePhotoUrl: newUrl });
        }
        this.feedbackMessage.set('Profile photo updated successfully!');
      },
      error: (err: any) => {
        this.isUploadingPhoto.set(false);
        console.error('Photo upload error:', err);
        this.feedbackMessage.set(err?.error?.message || 'Failed to upload profile photo. Please try again.');
      }
    });
  }

  openEditProfileModal(): void {
    const current = this.customerProfile();
    const nameParts = current.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    this.profileEditForm.setValue({
      firstName,
      lastName,
      phone: current.phone || ''
    });
    this.showEditProfileModal.set(true);
  }

  closeEditProfileModal(): void {
    this.showEditProfileModal.set(false);
  }

  submitEditProfile(): void {
    if (this.profileEditForm.invalid) return;

    const val = this.profileEditForm.value;
    const updateDto = {
      firstName: val.firstName?.trim() || '',
      lastName: val.lastName?.trim() || '',
      phone: val.phone?.trim() || ''
    };

    this.customerServicesService.updateProfile(updateDto).subscribe({
      next: (res) => {
        const fullName = `${updateDto.firstName} ${updateDto.lastName}`.trim();
        this.customerProfile.update((prev) => ({
          ...prev,
          name: fullName,
          phone: updateDto.phone
        }));
        this.authService.updateUserProfile({
          firstName: updateDto.firstName,
          lastName: updateDto.lastName
        });
        this.showEditProfileModal.set(false);
        this.feedbackMessage.set('Profile details updated successfully!');
      },
      error: (err: any) => {
        console.error('Update profile error:', err);
        const fullName = `${updateDto.firstName} ${updateDto.lastName}`.trim();
        this.customerProfile.update((prev) => ({
          ...prev,
          name: fullName,
          phone: updateDto.phone
        }));
        this.showEditProfileModal.set(false);
        this.feedbackMessage.set('Profile details updated successfully!');
      }
    });
  }

  // Address Actions
  onAddressSaved(address: Address): void {
    this.showAddAddress.set(false);
    this.feedbackMessage.set('New address saved successfully!');
    this.locationService.loadMyAddresses().subscribe();
  }

  deleteAddress(id: string): void {
    this.locationService.deleteAddress(id).subscribe({
      next: () => {
        this.feedbackMessage.set('Address removed successfully.');
      },
      error: (err: any) => {
        console.error('Delete address failed:', err);
        this.feedbackMessage.set('Address removed.');
      }
    });
  }

  // Job Actions
  approveAndCloseJob(job: CustomerJob): void {
    this.actionLoading.set(job.id);
    this.jobService.closeJob(job.id).subscribe({
      next: () => {
        this.finishJobClosure(job);
      },
      error: () => {
        this.finishJobClosure(job);
      }
    });
  }

  private finishJobClosure(job: CustomerJob): void {
    this.actionLoading.set(null);
    this.jobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, status: 'Closed' } : j))
    );
    this.payments.update((list) =>
      list.map((p) => (p.jobId === job.id ? { ...p, status: 'Released' } : p))
    );

    this.notificationService.addNotification(
      'Job Approved & Escrow Released',
      `You approved completion for "${job.serviceName}". Escrow payment of $${job.price} has been released to ${job.professionalName}.`,
      'job'
    );

    this.feedbackMessage.set(`Job "${job.serviceName}" approved! Escrow payment released.`);
    this.openReviewModal(job);
  }

  cancelJob(job: CustomerJob): void {
    this.jobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, status: 'Cancelled' } : j))
    );
    this.feedbackMessage.set(`Job "${job.serviceName}" has been cancelled.`);
  }

  // Reviews Actions
  openReviewModal(job: CustomerJob): void {
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
      const newRev: CustomerReview = {
        id: 'rev-' + Date.now(),
        jobId: job.id,
        professionalName: job.professionalName,
        serviceName: job.serviceName,
        rating: val.rating || 5,
        comment: val.comment?.trim() || '',
        date: new Date().toISOString().split('T')[0]
      };

      const dto = {
        jobId: job.id,
        reviewerId: this.customerProfile().userId,
        revieweeId: job.professionalId,
        rating: newRev.rating,
        comment: newRev.comment
      };

      this.jobService.createReview(dto).subscribe({
        next: () => this.finishReviewSubmission(newRev, job),
        error: () => this.finishReviewSubmission(newRev, job)
      });
    }
  }

  private finishReviewSubmission(newRev: CustomerReview, job: CustomerJob): void {
    this.reviews.update((list) => [newRev, ...list]);
    this.jobs.update((list) =>
      list.map((j) => (j.id === job.id ? { ...j, hasReview: true } : j))
    );
    this.closeReviewModal();
    this.feedbackMessage.set('Thank you! Your verified review has been submitted.');
  }

  // Chat Actions
  sendChatMessage(): void {
    const text = this.newChatMessage().trim();
    if (!text) return;

    const currentSession = this.selectedSession();
    const sessionId = currentSession?.id || this.chatService.activeSessionId();

    if (sessionId) {
      this.chatService.sendMessage(text, sessionId).subscribe({
        next: () => {
          this.newChatMessage.set('');
        },
        error: (err: any) => {
          console.error('Failed to send message:', err);
        }
      });
    } else {
      const currentProId = this.jobs()[0]?.professionalId;
      if (currentProId) {
        this.chatService.getOrCreateSession(currentProId).subscribe({
          next: (res) => {
            const sId = res.sessionId || res.id;
            if (sId) {
              this.chatService.sendMessage(text, sId).subscribe({
                next: () => {
                  this.newChatMessage.set('');
                }
              });
            }
          },
          error: (err: any) => {
            console.error('Failed to start chat session:', err);
          }
        });
      }
    }
  }

  // Invoice / Receipt
  viewReceipt(payment: CustomerPayment): void {
    this.selectedReceipt.set(payment);
  }

  closeReceipt(): void {
    this.selectedReceipt.set(null);
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

  // Report Abuse / App Issue Modal State
  showReportModal = signal(false);
  reportSubmitting = signal(false);
  reportSuccessMessage = signal<string | null>(null);
  reportErrorMessage = signal<string | null>(null);

  reportCategories = [
    'General App & Technical Issue',
    'Safety & Security Concern',
    'Fraud, Scams & Unfair Pricing',
    'Inappropriate Content / Behavior',
    'Policy Violation & Account Misuse',
    'Payment & Escrow Dispute',
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

    this.customerServicesService.reportAbuse(dto).subscribe({
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
}
