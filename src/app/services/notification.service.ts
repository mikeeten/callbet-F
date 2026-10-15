import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ChatSignalrService, NotificationDto } from './chat-signalr.service';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
  type: 'job' | 'booking' | 'system' | 'review' | 'assignment' | 'chat';
  recipientRole?: 'customer' | 'professional' | 'all';
  jobId?: string;
  stage?: number; // 1: Created, 2: Assigned, 3: InProgress, 4: Completed, 5: Closed
  customerName?: string;
  serviceName?: string;
  price?: number;
  reviewId?: string;
}

export interface PagedNotificationResponse {
  items: NotificationItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private signalr = inject(ChatSignalrService);
  private apiUrl = 'http://localhost:5189/api/chat';

  // State Signal - pure backend source of truth, initially empty
  private notificationsSignal = signal<NotificationItem[]>([]);

  // Public Signals
  notifications = this.notificationsSignal.asReadonly();
  unreadCount = computed(() => this.notificationsSignal().filter((n) => !n.isRead).length);

  // Professional-specific filtered notifications
  professionalNotifications = computed(() =>
    this.notificationsSignal().filter(
      (n) => n.recipientRole === 'professional' || n.recipientRole === 'all' || !n.recipientRole
    )
  );

  unreadProfessionalCount = computed(() =>
    this.professionalNotifications().filter((n) => !n.isRead).length
  );

  // Customer-specific filtered notifications
  customerNotifications = computed(() =>
    this.notificationsSignal().filter(
      (n) => n.recipientRole === 'customer' || n.recipientRole === 'all' || !n.recipientRole
    )
  );

  unreadCustomerCount = computed(() =>
    this.customerNotifications().filter((n) => !n.isRead).length
  );

  constructor() {
    // Clear legacy prototype storage keys if any exist in browser
    try {
      localStorage.removeItem('callbet_notifications');
      localStorage.removeItem('callbet_notifications_v2');
    } catch {
      // Ignore in non-browser context
    }

    // 📡 Reactively receive live notifications from Chat, Direct Job Bookings, Status Changes, Reviews, and Verifications
    this.signalr.notificationReceived$.subscribe((newNotif: NotificationDto) => {
      this.handleIncomingLiveNotification(newNotif);
    });
  }

  private handleIncomingLiveNotification(dto: NotificationDto): void {
    const newItem: NotificationItem = {
      id: dto.id || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9)),
      title: this.deriveTitle(dto.message),
      message: dto.message,
      link: dto.link,
      isRead: dto.isRead || false,
      createdAt: dto.createdAt || new Date().toISOString(),
      type: this.deriveType(dto.message, dto.link),
      stage: this.deriveStage(dto.message),
      jobId: this.deriveJobId(dto.link),
      customerName: this.deriveCustomerName(dto.message),
      serviceName: this.deriveServiceName(dto.message),
      price: this.derivePrice(dto.message),
      recipientRole: 'all'
    };

    const existing = this.notificationsSignal();
    if (!existing.some((n) => n.id === newItem.id)) {
      const updated = [newItem, ...existing];
      this.notificationsSignal.set(updated);
      this.triggerLiveAlert(dto);
    }
  }

  public deriveTitle(message: string): string {
    if (!message) return 'New Alert';
    if (message.includes('New Job Request') || message.includes('Direct Job')) return 'New Job Booking';
    if (message.includes('Assigned') || message.includes('accepted')) return 'Job Assigned';
    if (message.includes('Started') || message.includes('InProgress')) return 'Job In Progress';
    if (message.includes('Completed')) return 'Job Completed';
    if (message.includes('Closed') || message.includes('Approved')) return 'Job Closed & Approved';
    if (message.includes('Review') || message.includes('rating')) return 'New Verified Review';
    if (message.includes('Verification') || message.includes('KYC')) return 'Account Verification Update';
    if (message.includes('incident report') || message.includes('inquiry') || message.includes('incident claim') || message.includes('resolved by Administration')) return 'Incident Report Resolved';
    if (message.includes('message') || message.includes('chat')) return 'New Message';
    return 'System Notification';
  }

  public deriveType(message: string, link?: string): 'job' | 'booking' | 'system' | 'review' | 'assignment' | 'chat' {
    const str = `${message} ${link || ''}`.toLowerCase();
    if (str.includes('chat') || str.includes('message')) return 'chat';
    if (str.includes('review') || str.includes('rating')) return 'review';
    if (str.includes('booking') || str.includes('request')) return 'booking';
    if (str.includes('assign')) return 'assignment';
    if (str.includes('job') || str.includes('work')) return 'job';
    return 'system';
  }

  public deriveStage(message: string): number {
    if (!message) return 1;
    const msg = message.toLowerCase();
    if (msg.includes('new job request') || msg.includes('direct job') || msg.includes('booked')) return 1;
    if (msg.includes('assigned') || msg.includes('accepted')) return 2;
    if (msg.includes('started') || msg.includes('inprogress') || msg.includes('working on')) return 3;
    if (msg.includes('completed') || msg.includes('marked the job as completed')) return 4;
    if (msg.includes('closed') || msg.includes('approved')) return 5;
    return 1;
  }

  public deriveJobId(link?: string): string | undefined {
    if (!link) return undefined;
    const match = link.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return match ? match[0] : undefined;
  }

  public deriveCustomerName(message: string): string | undefined {
    if (!message) return undefined;
    const match = message.match(/from\s+([A-Za-z0-9\s]+?)(?:\s+for|\s+on|\.|$)/i);
    return match ? match[1].trim() : undefined;
  }

  public deriveServiceName(message: string): string | undefined {
    if (!message) return undefined;
    const match = message.match(/for\s+(?:service\s+)?([A-Za-z0-9\s]+?)(?:\s+at|\s+\$|\.|$)/i);
    return match ? match[1].trim() : undefined;
  }

  public derivePrice(message: string): number | undefined {
    if (!message) return undefined;
    const match = message.match(/\$(\d+(?:\.\d{1,2})?)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Fetch real user notifications from backend API (default 50 items for state/unread badges)
   */
  public loadNotifications(): void {
    this.signalr.startConnection();

    this.http.get<any>(`${this.apiUrl}/my-notifications?pageSize=50`).subscribe({
      next: (data) => {
        const rawItems: NotificationDto[] = Array.isArray(data) ? data : (data?.items || []);
        const apiItems: NotificationItem[] = rawItems.map((d) => ({
          id: d.id,
          title: this.deriveTitle(d.message),
          message: d.message,
          link: d.link,
          isRead: d.isRead,
          createdAt: d.createdAt,
          type: this.deriveType(d.message, d.link),
          stage: this.deriveStage(d.message),
          jobId: this.deriveJobId(d.link),
          customerName: this.deriveCustomerName(d.message),
          serviceName: this.deriveServiceName(d.message),
          price: this.derivePrice(d.message),
          recipientRole: 'all'
        }));

        const sorted = apiItems.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        this.notificationsSignal.set(sorted);
      },
      error: (err) => {
        console.warn('GET /api/chat/my-notifications notice:', err?.message || err);
      }
    });
  }

  /**
   * Fetch paginated notifications with optional server-side search & status filtering
   */
  public getNotificationsPaged(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Observable<PagedNotificationResponse> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status && params.status !== 'all') httpParams = httpParams.set('status', params.status);

    return this.http.get<any>(`${this.apiUrl}/my-notifications`, { params: httpParams }).pipe(
      map((res) => {
        const rawItems: NotificationDto[] = Array.isArray(res) ? res : (res?.items || []);
        const items: NotificationItem[] = rawItems.map((d) => ({
          id: d.id,
          title: this.deriveTitle(d.message),
          message: d.message,
          link: d.link,
          isRead: d.isRead,
          createdAt: d.createdAt,
          type: this.deriveType(d.message, d.link),
          stage: this.deriveStage(d.message),
          jobId: this.deriveJobId(d.link),
          customerName: this.deriveCustomerName(d.message),
          serviceName: this.deriveServiceName(d.message),
          price: this.derivePrice(d.message),
          recipientRole: 'all'
        }));

        const totalCount = res?.totalCount ?? items.length;
        const page = res?.page ?? (params?.page || 1);
        const pageSize = res?.pageSize ?? (params?.pageSize || 10);
        const totalPages = res?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

        return {
          items,
          totalCount,
          page,
          pageSize,
          totalPages,
          hasPrevious: page > 1,
          hasNext: page < totalPages
        };
      })
    );
  }

  public triggerLiveAlert(notification?: NotificationDto): void {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {
      // Audio autoplay policy fallback
    }
  }

  addNotification(
    title: string,
    message: string,
    type: 'job' | 'booking' | 'system' | 'review' | 'assignment' | 'chat' = 'job',
    link?: string,
    extra?: Partial<NotificationItem>
  ): void {
    // Re-fetch backend notifications
    this.loadNotifications();
  }

  updateJobNotificationStage(jobId: string, newStage: number, title: string, message: string): void {
    // Re-fetch backend notifications
    this.loadNotifications();
  }

  markAsRead(id: string): void {
    // 1. Update backend
    this.http.put(`${this.apiUrl}/notifications/${id}/read`, {}).subscribe({
      next: () => {
        const updated = this.notificationsSignal().map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSignal.set(updated);
      },
      error: () => {
        const updated = this.notificationsSignal().map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        this.notificationsSignal.set(updated);
      }
    });
  }

  markAllAsRead(): void {
    const unread = this.notificationsSignal().filter((n) => !n.isRead);
    unread.forEach((n) => {
      this.http.put(`${this.apiUrl}/notifications/${n.id}/read`, {}).subscribe({
        next: () => {},
        error: () => {}
      });
    });

    const updated = this.notificationsSignal().map((n) => ({ ...n, isRead: true }));
    this.notificationsSignal.set(updated);
  }

  deleteNotification(id: string): void {
    const updated = this.notificationsSignal().filter((n) => n.id !== id);
    this.notificationsSignal.set(updated);
  }

  clearAll(): void {
    this.notificationsSignal.set([]);
  }
}
