import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ChatSignalrService, ChatMessageDto, NotificationDto } from './chat-signalr.service';

export interface ChatMessage {
  id?: string;
  chatSessionId: string;
  senderId?: string;
  receiverId?: string;
  senderName?: string;
  senderRole?: 'Customer' | 'Professional' | 'Admin';
  content: string;
  sentAt?: string;
  isRead?: boolean;
}

export interface ChatSession {
  id: string;
  customerId: string;
  customerName?: string;
  customerAvatar?: string;
  professionalId: string;
  professionalName?: string;
  professionalAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  createdAt?: string;
}

export interface ChatNotification {
  id: string;
  userId: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  public signalr = inject(ChatSignalrService);
  private apiUrl = 'http://localhost:5189/api/chat';

  // Reactive State Signals
  sessions = signal<ChatSession[]>([]);
  activeSessionId = signal<string | null>(null);
  activeMessages = signal<ChatMessage[]>([]);
  notifications = signal<ChatNotification[]>([]);
  
  loadingSessions = signal<boolean>(false);
  loadingMessages = signal<boolean>(false);
  sendingMessage = signal<boolean>(false);

  // Typing state for active session
  typingUser = signal<{ sessionId: string; userId: string; isTyping: boolean } | null>(null);
  private typingTimer: any = null;

  isOtherUserTyping = computed(() => {
    const typing = this.typingUser();
    const currentActiveSession = this.activeSessionId();
    const currentUserId = this.authService.currentUser()?.id;
    if (!typing || !currentActiveSession) return false;
    return typing.sessionId === currentActiveSession && typing.isTyping && typing.userId !== currentUserId;
  });

  unreadNotificationCount = computed(() =>
    this.notifications().filter((n) => !n.isRead).length
  );

  constructor() {
    this.initSignalRListeners();
  }

  /**
   * Start SignalR realtime connection
   */
  public startRealtime(): void {
    this.signalr.startConnection();
  }

  /**
   * Listen to real-time events from SignalR
   */
  private initSignalRListeners(): void {
    // 1. Incoming Real-Time Chat Message
    this.signalr.messageReceived$.subscribe((msg: ChatMessageDto) => {
      const activeId = this.activeSessionId();

      // If belongs to the currently open chat session, append with deduplication
      if (activeId && msg.chatSessionId === activeId) {
        this.activeMessages.update((list) => {
          const exists = list.some((m) => (m.id && m.id === msg.id) || (m.content === msg.content && m.sentAt === msg.sentAt));
          if (exists) return list;
          return [...list, {
            id: msg.id,
            chatSessionId: msg.chatSessionId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            senderName: msg.senderName,
            senderRole: msg.senderRole,
            content: msg.content,
            sentAt: msg.sentAt || new Date().toISOString(),
            isRead: msg.isRead || false
          }];
        });

        // Auto mark as read if receiver is current user
        const currentUserId = this.authService.currentUser()?.id;
        if (msg.id && msg.senderId !== currentUserId) {
          this.markMessageAsRead(msg.id).subscribe();
        }
      }

      // Update session snippet & time in sidebar
      this.sessions.update((sessionList) => {
        return sessionList.map((s) => {
          if (s.id === msg.chatSessionId) {
            const isDifferentSession = s.id !== activeId;
            return {
              ...s,
              lastMessage: msg.content,
              lastMessageTime: msg.sentAt || new Date().toISOString(),
              unreadCount: isDifferentSession ? (s.unreadCount || 0) + 1 : s.unreadCount
            };
          }
          return s;
        });
      });
    });

    // 2. Incoming Real-Time Notification
    this.signalr.notificationReceived$.subscribe((notif: NotificationDto) => {
      this.notifications.update((list) => {
        const exists = list.some((n) => n.id === notif.id);
        if (exists) return list;
        return [{
          id: notif.id,
          userId: notif.userId,
          message: notif.message,
          link: notif.link,
          isRead: notif.isRead,
          createdAt: notif.createdAt || new Date().toISOString()
        }, ...list];
      });
    });

    // 3. Message Read Status Update
    this.signalr.messageRead$.subscribe(({ messageId }) => {
      this.activeMessages.update((list) =>
        list.map((m) => (m.id === messageId ? { ...m, isRead: true } : m))
      );
    });

    // 4. User Typing Indicator
    this.signalr.userTyping$.subscribe((typingInfo) => {
      this.typingUser.set(typingInfo);
      if (this.typingTimer) clearTimeout(this.typingTimer);
      if (typingInfo.isTyping) {
        this.typingTimer = setTimeout(() => {
          this.typingUser.set(null);
        }, 3000);
      }
    });
  }

  // 1. Create or retrieve session
  getOrCreateSession(professionalId?: string, customerId?: string): Observable<{ message: string; id: string; sessionId: string }> {
    const payload: any = {};
    if (professionalId) payload.professionalId = professionalId;
    if (customerId) payload.customerId = customerId;

    return this.http.post<{ message: string; id: string; sessionId: string }>(`${this.apiUrl}/session`, payload).pipe(
      tap((res) => {
        const sId = res?.sessionId || res?.id;
        if (sId) {
          this.selectSession(sId);
          this.loadMySessions().subscribe();
        }
      })
    );
  }

  /**
   * Select a session, join the SignalR room, and load messages
   */
  selectSession(sessionId: string): void {
    const prevSession = this.activeSessionId();
    if (prevSession && prevSession !== sessionId) {
      this.signalr.leaveSession(prevSession);
    }

    this.activeSessionId.set(sessionId);
    this.signalr.joinSession(sessionId);
    this.loadMessages(sessionId).subscribe();
  }

  // 2. Fetch all messages in a session
  loadMessages(sessionId: string): Observable<ChatMessage[]> {
    this.loadingMessages.set(true);
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/${sessionId}`).pipe(
      tap({
        next: (msgs) => {
          this.activeMessages.set(msgs || []);
          this.loadingMessages.set(false);
        },
        error: () => {
          this.loadingMessages.set(false);
        }
      })
    );
  }

  // 3. Send message
  sendMessage(content: string, sessionId?: string, receiverId?: string): Observable<any> {
    const targetSessionId = sessionId || this.activeSessionId();
    if (!targetSessionId) {
      throw new Error('No active chat session selected.');
    }

    this.sendingMessage.set(true);

    const payload: Partial<ChatMessage> = {
      chatSessionId: targetSessionId,
      content: content.trim(),
      receiverId
    };

    return this.http.post(`${this.apiUrl}/message`, payload).pipe(
      tap({
        next: () => {
          this.sendingMessage.set(false);
          // Reload messages and sessions for full sync
          this.loadMessages(targetSessionId).subscribe();
          this.loadMySessions().subscribe();
        },
        error: (err) => {
          this.sendingMessage.set(false);
          console.error('Error sending message:', err);
        }
      })
    );
  }

  // 4. Send typing indicator
  sendTyping(isTyping: boolean): void {
    const activeId = this.activeSessionId();
    if (activeId) {
      this.signalr.sendTyping(activeId, isTyping);
    }
  }

  // 5. Fetch user's chat sessions
  loadMySessions(): Observable<ChatSession[]> {
    this.loadingSessions.set(true);
    this.startRealtime();

    return this.http.get<ChatSession[]>(`${this.apiUrl}/my-sessions`).pipe(
      tap({
        next: (sessions) => {
          this.sessions.set(sessions || []);
          this.loadingSessions.set(false);
        },
        error: () => {
          this.loadingSessions.set(false);
        }
      })
    );
  }

  // 6. Fetch user's notifications
  loadMyNotifications(): Observable<ChatNotification[]> {
    this.startRealtime();

    return this.http.get<ChatNotification[]>(`${this.apiUrl}/my-notifications`).pipe(
      tap({
        next: (nList) => {
          this.notifications.set(nList || []);
        }
      })
    );
  }

  // 7. Mark notification as read
  markNotificationAsRead(notificationId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/notifications/${notificationId}/read`, {}).pipe(
      tap(() => {
        this.notifications.update((list) =>
          list.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        );
      })
    );
  }

  // 8. Mark message as read
  markMessageAsRead(messageId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/messages/${messageId}/read`, {});
  }
}
