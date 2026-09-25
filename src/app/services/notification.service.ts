import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private signalr = inject(ChatSignalrService);
  private apiUrl = 'http://localhost:5189/api/chat';
  private storageKey = 'callbet_notifications_v2';

  // State Signal
  private notificationsSignal = signal<NotificationItem[]>(this.getInitialNotifications());

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
      recipientRole: 'all'
    };

    const existing = this.notificationsSignal();
    if (!existing.some((n) => n.id === newItem.id)) {
      const updated = [newItem, ...existing];
      this.notificationsSignal.set(updated);
      this.saveToStorage(updated);
      this.triggerLiveAlert(dto);
    }
  }

  private deriveTitle(message: string): string {
    if (!message) return 'New Alert';
    if (message.includes('New Job Request') || message.includes('Direct Job')) return 'New Job Booking';
    if (message.includes('Assigned') || message.includes('accepted')) return 'Job Assigned';
    if (message.includes('Started') || message.includes('InProgress')) return 'Job In Progress';
    if (message.includes('Completed')) return 'Job Completed';
    if (message.includes('Closed') || message.includes('Approved')) return 'Job Closed & Approved';
    if (message.includes('Review') || message.includes('rating')) return 'New Verified Review';
    if (message.includes('Verification') || message.includes('KYC')) return 'Account Verification Update';
    if (message.includes('message') || message.includes('chat')) return 'New Message';
    return 'System Notification';
  }

  private deriveType(message: string, link?: string): 'job' | 'booking' | 'system' | 'review' | 'assignment' | 'chat' {
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

  /**
   * Fetch user notifications from backend API
   */
  public loadNotifications(): void {
    this.signalr.startConnection();

    this.http.get<NotificationDto[]>(`${this.apiUrl}/my-notifications`).subscribe({
      next: (data) => {
        if (data && Array.isArray(data)) {
          const apiItems: NotificationItem[] = data.map((d) => ({
            id: d.id,
            title: this.deriveTitle(d.message),
            message: d.message,
            link: d.link,
            isRead: d.isRead,
            createdAt: d.createdAt,
            type: this.deriveType(d.message, d.link),
            stage: this.deriveStage(d.message),
            jobId: this.deriveJobId(d.link),
            recipientRole: 'all'
          }));

          // Merge with stored local items without duplicates
          const currentMap = new Map<string, NotificationItem>();
          apiItems.forEach((item) => currentMap.set(item.id, item));
          this.notificationsSignal().forEach((item) => {
            if (!currentMap.has(item.id)) {
              currentMap.set(item.id, item);
            }
          });

          const merged = Array.from(currentMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          this.notificationsSignal.set(merged);
          this.saveToStorage(merged);
        }
      },
      error: (err) => {
        console.warn('GET /api/chat/my-notifications notice:', err?.message || err);
      }
    });
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

  private getInitialNotifications(): NotificationItem[] {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }

    return [];
  }

  private saveToStorage(items: NotificationItem[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (e) {
      console.warn('Could not save notifications to localStorage', e);
    }
  }

  addNotification(
    title: string,
    message: string,
    type: 'job' | 'booking' | 'system' | 'review' | 'assignment' | 'chat' = 'job',
    link?: string,
    extra?: Partial<NotificationItem>
  ): void {
    const newItem: NotificationItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      title,
      message,
      link,
      isRead: false,
      createdAt: new Date().toISOString(),
      type,
      ...extra
    };

    const updated = [newItem, ...this.notificationsSignal()];
    this.notificationsSignal.set(updated);
    this.saveToStorage(updated);
    this.triggerLiveAlert();
  }

  updateJobNotificationStage(jobId: string, newStage: number, title: string, message: string): void {
    const updated = this.notificationsSignal().map((n) => {
      if (n.jobId === jobId) {
        return {
          ...n,
          stage: newStage,
          title,
          message,
          isRead: false,
          createdAt: new Date().toISOString()
        };
      }
      return n;
    });

    this.notificationsSignal.set(updated);
    this.saveToStorage(updated);
    this.triggerLiveAlert();
  }

  markAsRead(id: string): void {
    // 1. Update backend
    this.http.put(`${this.apiUrl}/notifications/${id}/read`, {}).subscribe({
      next: () => {},
      error: () => {}
    });

    // 2. Optimistic local update
    const updated = this.notificationsSignal().map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this.notificationsSignal.set(updated);
    this.saveToStorage(updated);
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
    this.saveToStorage(updated);
  }

  deleteNotification(id: string): void {
    const updated = this.notificationsSignal().filter((n) => n.id !== id);
    this.notificationsSignal.set(updated);
    this.saveToStorage(updated);
  }

  clearAll(): void {
    this.notificationsSignal.set([]);
    this.saveToStorage([]);
  }
}
