import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSliderModule } from '@angular/material/slider';
import {
  CustomerServicesService,
  ProfessionalProfileServiceDto,
  CustomerServicesFilterParams
} from '../services/customer-services.service';
import { LocationService, SubCity, Neighborhood } from '../services/location.service';
import { NotificationService } from '../services/notification.service';
import { JobWorkflowModalComponent } from '../job-workflow/job-workflow-modal.component';
import { MapModalComponent } from '../components/map-modal/map-modal.component';
import { AuthService } from '../core/services/auth.service';
import { ChatService, ChatSession } from '../services/chat.service';
import { Router } from '@angular/router';

export interface LocationPreset {
  name: string;
  subCity: string;
  lat: number;
  lng: number;
  icon?: string;
}

@Component({
  selector: 'app-customer-services',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatSliderModule,
    JobWorkflowModalComponent,
    MapModalComponent
  ],
  templateUrl: './customer-services.component.html',
  styleUrls: ['./customer-services.component.scss']
})
export class CustomerServicesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private customerServicesService = inject(CustomerServicesService);
  public locationService = inject(LocationService);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  public chatService = inject(ChatService);
  public router = inject(Router);

  // Direct Live Chat with Professional State
  isChatModalOpen = signal<boolean>(false);
  selectedChatProfessional = signal<ProfessionalProfileServiceDto | null>(null);
  selectedChatSession = signal<ChatSession | null>(null);
  chatInputText = signal<string>('');
  chatLoading = signal<boolean>(false);

  // State Signals
  services = signal<ProfessionalProfileServiceDto[]>([]);
  categories = signal<any[]>([]);
  totalCount = signal(0);
  page = signal(1);
  pageSize = signal(9);
  selectedCategoryId = signal<string | null>(null);
  selectedServiceForBooking = signal<ProfessionalProfileServiceDto | null>(null);
  showWorkflowModal = signal(false);
  showNotificationsPanel = signal(false);
  loading = signal(false);
  bookingSubmitting = signal(false);
  bookingSuccess = signal<string | null>(null);
  bookingError = signal<string | null>(null);
  favoriteNotification = signal<string | null>(null);

  // Location & Proximity Signals
  subCities = signal<SubCity[]>([]);
  filteredNeighborhoods = signal<Neighborhood[]>([]);
  selectedSubCityId = signal<number | null>(null);
  selectedNeighborhoodId = signal<number | null>(null);
  selectedNeighborhoodName = signal<string | null>(null);

  gpsActive = signal<boolean>(false);
  gpsLoading = signal<boolean>(false);
  gpsError = signal<string | null>(null);
  currentLatitude = signal<number | null>(null);
  currentLongitude = signal<number | null>(null);
  radiusKm = signal<number>(2.5);
  gpsLocationLabel = signal<string | null>(null);
  locationDrawerOpen = signal<boolean>(false);

  // Interactive Map Preview State
  mapModalOpen = signal<boolean>(false);
  mapLat = signal<number>(9.0105);
  mapLng = signal<number>(38.7612);
  mapTitle = signal<string>('Bole Area, Addis Ababa');
  mapSubtitle = signal<string>('Searching within proximity');

  // Customer ID from token
  currentCustomerId = signal<string>('22222222-2222-2222-2222-222222222222');
  bookmarkedServiceIds = signal<Set<string>>(new Set());
  bookmarkedProIds = signal<Set<string>>(new Set());

  // Addis Ababa Quick Location Presets
  addisPresets: LocationPreset[] = [
    { name: 'Bole (Airport & Medhanialem)', subCity: 'Bole', lat: 9.0105, lng: 38.7612, icon: 'flight_takeoff' },
    { name: 'Kazanchis / UNECA Center', subCity: 'Kirkos', lat: 9.0185, lng: 38.7700, icon: 'apartment' },
    { name: 'Piassa / Arada Old City', subCity: 'Arada', lat: 9.0350, lng: 38.7520, icon: 'account_balance' },
    { name: 'Sarbet / Mekanisa', subCity: 'Nifas Silk-Lafto', lat: 8.9950, lng: 38.7350, icon: 'villa' },
    { name: 'CMC / Ayat / Summit', subCity: 'Lemi Kura', lat: 9.0200, lng: 38.8500, icon: 'location_city' },
    { name: 'Megenagna / Shola', subCity: 'Yeka', lat: 9.0210, lng: 38.7990, icon: 'hub' }
  ];

  // Common Radius Options (1 - 2.5 km)
  radiusOptions = [1, 1.5, 2, 2.5];

  // Computed total pages
  totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  // Filter Form
  filterForm = this.fb.group({
    search: [''],
    orderBy: ['name'],
    descending: [false],

  });

  // Category Icon Resolver
  getCategoryIcon(name: string): string {
    if (!name) return 'home_repair_service';
    const n = name.toLowerCase();
    if (n.includes('electric') || n.includes('power') || n.includes('wiring')) return 'electrical_services';
    if (n.includes('plumb') || n.includes('pipe') || n.includes('water') || n.includes('drain')) return 'plumbing';
    if (n.includes('clean') || n.includes('sanitat') || n.includes('maid') || n.includes('janitor')) return 'cleaning_services';
    if (n.includes('hvac') || n.includes('ac') || n.includes('air') || n.includes('cooling') || n.includes('heating')) return 'ac_unit';
    if (n.includes('carpent') || n.includes('wood') || n.includes('furniture')) return 'carpenter';
    if (n.includes('paint') || n.includes('wall') || n.includes('finish')) return 'format_paint';
    if (n.includes('appliance') || n.includes('repair') || n.includes('fix')) return 'build';
    if (n.includes('security') || n.includes('lock') || n.includes('cctv')) return 'security';
    if (n.includes('solar') || n.includes('energy') || n.includes('panel')) return 'solar_power';
    if (n.includes('garden') || n.includes('landscap') || n.includes('lawn')) return 'yard';
    if (n.includes('moving') || n.includes('shift') || n.includes('transport')) return 'local_shipping';
    return 'home_repair_service';
  }

  getInitials(name: string): string {
    if (!name) return 'P';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  setSortOption(orderBy: string, descending: boolean): void {
    this.filterForm.patchValue({ orderBy, descending });
    this.onFilterChange();
  }

  isSortActive(orderBy: string, descending: boolean): boolean {
    const val = this.filterForm.value;
    return val.orderBy === orderBy && !!val.descending === descending;
  }

  // Booking Form
  bookingForm = this.fb.group({
    customerId: ['', Validators.required],
    scheduledDateTime: [''],
    addressId: [''],
    description: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  ngOnInit(): void {
    this.initCustomerIdentity();
    this.loadCategories();
    this.loadSubCities();
    this.loadServices();
  }

  initCustomerIdentity(): void {
    const tokenUserId = this.authService.getUserId();
    if (tokenUserId) {
      this.currentCustomerId.set(tokenUserId);
      this.loadCustomerBookmarks(tokenUserId);
    } else {
      this.customerServicesService.getCustomerProfile().subscribe({
        next: (prof) => {
          const id = prof?.id || prof?.userId;
          if (id) {
            this.currentCustomerId.set(id);
            this.loadCustomerBookmarks(id);
          }
        },
        error: () => {}
      });
    }
  }

  loadCustomerBookmarks(customerId: string): void {
    this.customerServicesService.getFavoriteServices(customerId).subscribe({
      next: (favServices) => {
        if (favServices && Array.isArray(favServices)) {
          const ids = favServices.map((s: any) => s.serviceId || s.id);
          this.bookmarkedServiceIds.set(new Set(ids));
        }
      },
      error: () => {}
    });

    this.customerServicesService.getFavoriteProfessionals(customerId).subscribe({
      next: (favPros) => {
        if (favPros && Array.isArray(favPros)) {
          const ids = favPros.map((p: any) => p.professionalProfileId || p.id);
          this.bookmarkedProIds.set(new Set(ids));
        }
      },
      error: () => {}
    });
  }

  loadCategories(): void {
    this.customerServicesService.getCategories().subscribe({
      next: (cats: any) => {
        const list = Array.isArray(cats) ? cats : (cats?.items || []);
        this.categories.set(list);
      },
      error: (err) => console.error('Failed to load categories:', err)
    });
  }

  loadSubCities(): void {
    this.locationService.loadSubCities().subscribe({
      next: (subs) => this.subCities.set(subs || []),
      error: (err) => console.error('Failed to load subcities:', err)
    });
  }

  // ==========================================
  // LOCATION & GPS FILTER HANDLERS
  // ==========================================

  onSubCityChange(subCityId: number | null): void {
    this.selectedSubCityId.set(subCityId);
    this.selectedNeighborhoodId.set(null);
    this.selectedNeighborhoodName.set(null);

    if (subCityId) {
      const sub = this.subCities().find((s) => s.id === subCityId);
      if (sub && sub.neighborhoods && sub.neighborhoods.length > 0) {
        this.filteredNeighborhoods.set(sub.neighborhoods);
      } else {
        this.locationService.getNeighborhoodsBySubCity(subCityId).subscribe({
          next: (hoods) => this.filteredNeighborhoods.set(hoods || []),
          error: () => this.filteredNeighborhoods.set([])
        });
      }
    } else {
      this.filteredNeighborhoods.set([]);
    }
    this.onFilterChange();
  }

  onNeighborhoodChange(neighborhoodId: number | null): void {
    this.selectedNeighborhoodId.set(neighborhoodId);
    if (neighborhoodId) {
      const hood = this.filteredNeighborhoods().find((n) => n.id === neighborhoodId);
      this.selectedNeighborhoodName.set(hood?.name || `Neighborhood #${neighborhoodId}`);
      // Deactivate GPS search so neighborhood filter applies cleanly
      this.gpsActive.set(false);
      this.currentLatitude.set(null);
      this.currentLongitude.set(null);
      this.gpsLocationLabel.set(null);
      this.gpsError.set(null);
    } else {
      this.selectedNeighborhoodName.set(null);
    }
    this.onFilterChange();
  }

  useCurrentGpsLocation(): void {
    this.gpsLoading.set(true);
    this.gpsError.set(null);

    this.locationService.getCurrentLocation()
      .then((coords) => {
        this.currentLatitude.set(coords.latitude);
        this.currentLongitude.set(coords.longitude);
        this.gpsActive.set(true);
        this.gpsLoading.set(false);
        this.gpsLocationLabel.set('Live GPS Coordinates');
        // Clear neighborhood filter so GPS proximity filter applies cleanly
        this.selectedNeighborhoodId.set(null);
        this.selectedNeighborhoodName.set(null);
        this.selectedSubCityId.set(null);
        // Automatically switch sort to distance
        this.filterForm.patchValue({ orderBy: 'distance', descending: false });
        this.onFilterChange();
      })
      .catch((err) => {
        this.gpsLoading.set(false);
        this.gpsError.set('Browser GPS unavailable. Please select a preset location below.');
        console.warn('Geolocation error:', err);
      });
  }

  selectPresetGps(preset: LocationPreset): void {
    this.currentLatitude.set(preset.lat);
    this.currentLongitude.set(preset.lng);
    this.gpsActive.set(true);
    this.gpsError.set(null);
    this.gpsLocationLabel.set(preset.name);
    // Clear neighborhood filter
    this.selectedNeighborhoodId.set(null);
    this.selectedNeighborhoodName.set(null);
    this.selectedSubCityId.set(null);
    // Automatically switch sort to distance
    this.filterForm.patchValue({ orderBy: 'distance', descending: false });
    this.onFilterChange();
  }

  setRadius(radius: number): void {
    const clamped = Math.min(2.5, Math.max(1, Number(radius)));
    this.radiusKm.set(Number(clamped.toFixed(1)));
    if (this.gpsActive()) {
      this.onFilterChange();
    }
  }

  clearGpsFilter(): void {
    this.gpsActive.set(false);
    this.currentLatitude.set(null);
    this.currentLongitude.set(null);
    this.gpsLocationLabel.set(null);
    this.gpsError.set(null);
    if (this.filterForm.value.orderBy === 'distance') {
      this.filterForm.patchValue({ orderBy: 'name', descending: false });
    }
    this.onFilterChange();
  }

  clearNeighborhoodFilter(): void {
    this.selectedNeighborhoodId.set(null);
    this.selectedNeighborhoodName.set(null);
    this.selectedSubCityId.set(null);
    this.onFilterChange();
  }

  clearAllLocationFilters(): void {
    this.gpsActive.set(false);
    this.currentLatitude.set(null);
    this.currentLongitude.set(null);
    this.gpsLocationLabel.set(null);
    this.gpsError.set(null);
    this.selectedNeighborhoodId.set(null);
    this.selectedNeighborhoodName.set(null);
    this.selectedSubCityId.set(null);
    if (this.filterForm.value.orderBy === 'distance') {
      this.filterForm.patchValue({ orderBy: 'name', descending: false });
    }
    this.onFilterChange();
  }

  openMapLocation(lat?: number | null, lng?: number | null, title?: string | null, subtitle?: string | null): void {
    this.mapLat.set(lat || this.currentLatitude() || 9.0105);
    this.mapLng.set(lng || this.currentLongitude() || 38.7612);
    this.mapTitle.set(title || this.gpsLocationLabel() || 'Search Location (Addis Ababa)');
    this.mapSubtitle.set(subtitle || `Radius: ${this.radiusKm()} km proximity`);
    this.mapModalOpen.set(true);
  }

  closeMapModal(): void {
    this.mapModalOpen.set(false);
  }

  toggleLocationDrawer(): void {
    this.locationDrawerOpen.update((v) => !v);
  }

  // ==========================================
  // SERVICE DATA QUERY & PAGINATION
  // ==========================================

  loadServices(): void {
    this.loading.set(true);
    const formVal = this.filterForm.value;

    const params: CustomerServicesFilterParams = {
      page: this.page(),
      pageSize: this.pageSize(),
      search: formVal.search || undefined,
      categoryId: this.selectedCategoryId() || undefined,
      orderBy: formVal.orderBy || 'name',
      descending: !!formVal.descending
    };

    // Attach GPS coordinates & proximity radius if active
    if (this.gpsActive() && this.currentLatitude() !== null && this.currentLongitude() !== null) {
      params.latitude = this.currentLatitude();
      params.longitude = this.currentLongitude();
      params.radiusKm = this.radiusKm();
    }

    // Attach Neighborhood ID filter if selected
    if (this.selectedNeighborhoodId() !== null && this.selectedNeighborhoodId() !== undefined) {
      params.neighborhoodId = this.selectedNeighborhoodId();
    }

    this.customerServicesService.getProfessionalServices(params).subscribe({
      next: (response) => {
        this.services.set(response.items || []);
        this.totalCount.set(response.totalCount || 0);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load professional services:', err);
        this.loading.set(false);
      }
    });
  }

  selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.page.set(1);
    this.loadServices();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadServices();
  }

  toggleSortDirection(): void {
    const current = this.filterForm.get('descending')?.value;
    this.filterForm.patchValue({ descending: !current });
    this.onFilterChange();
  }


  openBooking(service: ProfessionalProfileServiceDto): void {
    this.selectedServiceForBooking.set(service);
    this.showWorkflowModal.set(true);
    this.bookingSuccess.set(null);
    this.bookingError.set(null);
    this.bookingForm.patchValue({
      description: `Request for ${service.serviceName} with ${service.professionalName}`
    });
  }

  closeBooking(): void {
    this.selectedServiceForBooking.set(null);
    this.showWorkflowModal.set(false);
    this.bookingSuccess.set(null);
    this.bookingError.set(null);
    this.bookingForm.reset();
  }

  toggleNotifications(): void {
    this.showNotificationsPanel.update((v) => !v);
  }

  submitBooking(): void {
    const selected = this.selectedServiceForBooking();
    if (!selected) return;

    if (this.bookingForm.valid) {
      this.bookingSubmitting.set(true);
      this.bookingSuccess.set(null);
      this.bookingError.set(null);

      const val = this.bookingForm.value;
      const jobDto = {
        customerId: val.customerId ? val.customerId.trim() : null,
        professionalId: selected.userId || selected.professionalProfileId,
        serviceId: selected.serviceId,
        description: val.description ? val.description.trim() : '',
        addressId: val.addressId ? val.addressId.trim() : null,
        scheduledDateTime: val.scheduledDateTime ? new Date(val.scheduledDateTime).toISOString() : null,
        estimatedDurationMins: selected.estimatedDurationMins || 60,
        price: selected.effectivePrice
      };

      this.customerServicesService.createJob(jobDto).subscribe({
        next: (res) => {
          this.bookingSubmitting.set(false);
          this.bookingSuccess.set(`Job created successfully in Draft status! Job ID: ${res.id}`);
          
          this.notificationService.addNotification(
            'Job Booking Created',
            `Your booking for "${selected.serviceName}" with ${selected.professionalName} is confirmed (Status: Draft).`,
            'booking',
            `/profile`
          );

          this.bookingForm.reset();
        },
        error: (err) => {
          console.error('Booking failed:', err);
          this.bookingSubmitting.set(false);
          this.bookingError.set(err?.error?.message || 'Failed to create job booking. Please check your inputs.');
        }
      });
    }
  }

  // ==========================================
  // BOOKMARK / FAVORITE METHODS
  // ==========================================

  isServiceBookmarked(serviceId: string): boolean {
    return this.bookmarkedServiceIds().has(serviceId);
  }

  isProBookmarked(proId: string): boolean {
    return this.bookmarkedProIds().has(proId);
  }

  toggleFavoriteService(service: ProfessionalProfileServiceDto, event?: Event): void {
    if (event) event.stopPropagation();

    const targetServiceId = service.serviceId || service.id;
    const custId = this.authService.getUserId() || this.currentCustomerId() || '22222222-2222-2222-2222-222222222222';
    const isBookmarked = this.bookmarkedServiceIds().has(targetServiceId);

    const req$ = isBookmarked
      ? this.customerServicesService.removeFavoriteService(targetServiceId, custId)
      : this.customerServicesService.addFavoriteService(custId, targetServiceId);

    req$.subscribe({
      next: () => {
        this.finishFavoriteServiceToggle(service, targetServiceId);
      },
      error: () => {
        this.finishFavoriteServiceToggle(service, targetServiceId);
      }
    });
  }

  private finishFavoriteServiceToggle(service: ProfessionalProfileServiceDto, targetServiceId: string): void {
    const current = new Set(this.bookmarkedServiceIds());
    if (current.has(targetServiceId)) {
      current.delete(targetServiceId);
      this.favoriteNotification.set(`Removed "${service.serviceName}" from favorites.`);
    } else {
      current.add(targetServiceId);
      this.favoriteNotification.set(`Saved "${service.serviceName}" to your favorite services!`);
      this.notificationService.addNotification(
        'Service Bookmarked',
        `You added "${service.serviceName}" to your favorites.`,
        'system',
        '/customer-dashboard'
      );
    }
    this.bookmarkedServiceIds.set(current);
    setTimeout(() => this.favoriteNotification.set(null), 4000);
  }

  toggleFavoriteProfessional(service: ProfessionalProfileServiceDto, event?: Event): void {
    if (event) event.stopPropagation();

    const proId = service.professionalProfileId;
    const custId = this.authService.getUserId() || this.currentCustomerId() || '22222222-2222-2222-2222-222222222222';
    const isBookmarked = this.bookmarkedProIds().has(proId);

    const req$ = isBookmarked
      ? this.customerServicesService.removeFavoriteProfessional(proId, custId)
      : this.customerServicesService.addFavoriteProfessional(custId, proId);

    req$.subscribe({
      next: () => {
        this.finishFavoriteProToggle(service, proId);
      },
      error: () => {
        this.finishFavoriteProToggle(service, proId);
      }
    });
  }

  private finishFavoriteProToggle(service: ProfessionalProfileServiceDto, proId: string): void {
    const current = new Set(this.bookmarkedProIds());
    if (current.has(proId)) {
      current.delete(proId);
      this.favoriteNotification.set(`Removed "${service.professionalName}" from favorites.`);
    } else {
      current.add(proId);
      this.favoriteNotification.set(`Bookmarked professional "${service.professionalName}"!`);
      this.notificationService.addNotification(
        'Professional Bookmarked',
        `You saved ${service.professionalName} to your trusted professionals list.`,
        'system',
        '/customer-dashboard'
      );
    }
    this.bookmarkedProIds.set(current);
    setTimeout(() => this.favoriteNotification.set(null), 4000);
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
      this.loadServices();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
      this.loadServices();
    }
  }

  // ==========================================
  // DIRECT CUSTOMER-TO-PROFESSIONAL LIVE CHAT
  // ==========================================

  openChatWithProfessional(service: ProfessionalProfileServiceDto, event?: Event): void {
    if (event) event.stopPropagation();

    // Check authentication
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/customer-services' } });
      return;
    }

    this.selectedChatProfessional.set(service);
    this.isChatModalOpen.set(true);
    this.chatLoading.set(true);

    const proId = service.userId || service.professionalProfileId || '';
    const custId = this.authService.getUserId() || this.currentCustomerId() || '';

    // Check if an existing session is in memory
    const existing = this.chatService.sessions().find(
      (s) =>
        (proId && s.professionalId === proId) ||
        (service.professionalName && s.professionalName?.trim().toLowerCase() === service.professionalName.trim().toLowerCase())
    );

    if (existing) {
      this.selectedChatSession.set(existing);
      this.chatService.selectSession(existing.id);
      this.chatLoading.set(false);
    } else {
      this.chatService.getOrCreateSession(proId, custId).subscribe({
        next: (res) => {
          this.chatLoading.set(false);
          const sId = res?.sessionId || res?.id;
          if (sId) {
            const newSess: ChatSession = {
              id: sId,
              customerId: custId,
              customerName: 'Customer',
              professionalId: proId,
              professionalName: service.professionalName || 'Professional Specialist'
            };
            this.selectedChatSession.set(newSess);
            this.chatService.selectSession(sId);
          }
        },
        error: (err) => {
          this.chatLoading.set(false);
          console.warn('Could not retrieve remote session, using direct session channel:', err);
          const fallbackId = `session-${proId}-${custId}`;
          const fallbackSess: ChatSession = {
            id: fallbackId,
            customerId: custId,
            customerName: 'Customer',
            professionalId: proId,
            professionalName: service.professionalName || 'Professional Specialist'
          };
          this.selectedChatSession.set(fallbackSess);
          this.chatService.selectSession(fallbackId);
        }
      });
    }
  }

  closeChatModal(): void {
    this.isChatModalOpen.set(false);
    this.selectedChatProfessional.set(null);
    this.selectedChatSession.set(null);
  }

  onChatTyping(): void {
    this.chatService.sendTyping(true);
  }

  sendChatMessage(): void {
    const text = this.chatInputText().trim();
    if (!text) return;

    const session = this.selectedChatSession();
    const activeSessionId = session?.id || this.chatService.activeSessionId();
    if (!activeSessionId) return;

    const pro = this.selectedChatProfessional();
    const receiverId = session?.professionalId || pro?.userId || pro?.professionalProfileId || undefined;
    const authUser = this.authService.currentUser();

    this.chatService.sendMessage(text, activeSessionId, receiverId).subscribe({
      next: () => {
        this.chatInputText.set('');
        this.chatService.sendTyping(false);
      },
      error: (err) => {
        console.warn('Chat send notice, updating optimistic UI:', err);
        this.chatInputText.set('');
        this.chatService.activeMessages.update((list) => [
          ...list,
          {
            id: 'msg-' + Date.now(),
            chatSessionId: activeSessionId,
            senderId: authUser?.id || this.currentCustomerId(),
            receiverId: receiverId,
            senderName: authUser?.firstName ? `${authUser.firstName} ${authUser.lastName || ''}`.trim() : 'Customer',
            senderRole: 'Customer',
            content: text,
            sentAt: new Date().toISOString(),
            isRead: false
          }
        ]);
      }
    });
  }

  isMyChatMessage(msg: any): boolean {
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
}
