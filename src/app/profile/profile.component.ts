import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationService, NotificationItem } from '../services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatBadgeModule
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  public notificationService = inject(NotificationService);

  // State Signals
  activeFilter = signal<'all' | 'unread' | 'read'>('all');

  // Filtered Notifications based on active filter
  filteredNotifications = computed(() => {
    const list = this.notificationService.notifications();
    const filter = this.activeFilter();

    if (filter === 'unread') {
      return list.filter((n) => !n.isRead);
    }
    if (filter === 'read') {
      return list.filter((n) => n.isRead);
    }
    return list;
  });

  setFilter(filter: 'all' | 'unread' | 'read'): void {
    this.activeFilter.set(filter);
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id);
  }

  clearAll(): void {
    this.notificationService.clearAll();
  }
}
