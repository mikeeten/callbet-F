import { Injectable, signal, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject, Observable } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

export interface ChatMessageDto {
  id?: string;
  chatSessionId: string;
  senderId: string;
  receiverId?: string;
  senderName?: string;
  senderRole?: 'Customer' | 'Professional' | 'Admin';
  content: string;
  isRead?: boolean;
  sentAt?: string;
}

export interface NotificationDto {
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
export class ChatSignalrService {
  private authService = inject(AuthService);
  private hubConnection: signalR.HubConnection | null = null;
  private hubUrl = 'http://localhost:5189/hubs/chat';

  // Reactive Connection State Signal
  public connectionStatus = signal<'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting'>('Disconnected');

  // Event Streams
  private messageSubject = new Subject<ChatMessageDto>();
  public messageReceived$: Observable<ChatMessageDto> = this.messageSubject.asObservable();

  private notificationSubject = new Subject<NotificationDto>();
  public notificationReceived$: Observable<NotificationDto> = this.notificationSubject.asObservable();

  private messageReadSubject = new Subject<{ messageId: string; userId: string }>();
  public messageRead$: Observable<{ messageId: string; userId: string }> = this.messageReadSubject.asObservable();

  private typingSubject = new Subject<{ sessionId: string; userId: string; isTyping: boolean }>();
  public userTyping$: Observable<{ sessionId: string; userId: string; isTyping: boolean }> = this.typingSubject.asObservable();

  private activeJoinedSessions = new Set<string>();

  public startConnection(): void {
    const token = this.getAuthToken();
    if (!token || !this.isTokenValid(token)) {
      // Do not attempt to negotiate with SignalR if unauthenticated or token expired
      return;
    }

    if (this.hubConnection && (this.hubConnection.state === signalR.HubConnectionState.Connected || this.hubConnection.state === signalR.HubConnectionState.Connecting)) {
      return;
    }

    this.connectionStatus.set('Connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => {
          const t = this.getAuthToken();
          return this.isTokenValid(t) ? t : '';
        },
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // 📡 Register Event Listeners
    this.hubConnection.on('ReceiveChatMessage', (message: ChatMessageDto) => {
      this.messageSubject.next(message);
    });

    this.hubConnection.on('ReceiveNotification', (notification: NotificationDto) => {
      this.notificationSubject.next(notification);
    });

    this.hubConnection.on('MessageReadStatus', (messageId: string, userId: string) => {
      this.messageReadSubject.next({ messageId, userId });
    });

    this.hubConnection.on('UserTyping', (sessionId: string, userId: string, isTyping: boolean) => {
      this.typingSubject.next({ sessionId, userId, isTyping });
    });

    // Reconnection State Hooks
    this.hubConnection.onreconnecting(() => {
      this.connectionStatus.set('Reconnecting');
    });

    this.hubConnection.onreconnected(async () => {
      this.connectionStatus.set('Connected');
      // Re-join previously joined active sessions
      for (const sId of this.activeJoinedSessions) {
        try {
          await this.hubConnection?.invoke('JoinSession', sId);
        } catch (e) {
          console.error(`Error rejoining session ${sId}:`, e);
        }
      }
    });

    this.hubConnection.onclose(() => {
      this.connectionStatus.set('Disconnected');
    });

    this.hubConnection.start()
      .then(() => {
        this.connectionStatus.set('Connected');
        console.log('📡 SignalR Chat Hub Connected successfully.');
      })
      .catch((err) => {
        this.connectionStatus.set('Disconnected');
        console.warn('SignalR Hub Connection Notice (will retry on next activity):', err?.message || err);
      });
  }

  public stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionStatus.set('Disconnected');
      this.activeJoinedSessions.clear();
    }
  }

  public async joinSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    this.activeJoinedSessions.add(sessionId);

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('JoinSession', sessionId);
      } catch (err) {
        console.error(`Error joining session ${sessionId}:`, err);
      }
    }
  }

  public async leaveSession(sessionId: string): Promise<void> {
    if (!sessionId) return;
    this.activeJoinedSessions.delete(sessionId);

    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('LeaveSession', sessionId);
      } catch (err) {
        console.error(`Error leaving session ${sessionId}:`, err);
      }
    }
  }

  public async sendTyping(sessionId: string, isTyping: boolean): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('SendTyping', sessionId, isTyping);
      } catch (err) {
        console.error('Error sending typing indicator:', err);
      }
    }
  }

  public isTokenValid(token: string): boolean {
    if (!token || token.length < 10) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return true;
      // payload.exp is in seconds, compare with Date.now() in ms
      const isExpired = payload.exp * 1000 <= Date.now();
      return !isExpired;
    } catch {
      return false;
    }
  }

  private getAuthToken(): string {
    return this.authService.getAccessToken() ||
           localStorage.getItem('callbet_access_token') ||
           localStorage.getItem('token') ||
           localStorage.getItem('accessToken') ||
           '';
  }
}
