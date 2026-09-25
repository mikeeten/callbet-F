import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/services/auth.service';
import { ChatSignalrService } from '../services/chat-signalr.service';

@Component({
  selector: 'app-signout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './signout.component.html',
  styleUrls: ['./signout.component.scss']
})
export class SignoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private signalrService = inject(ChatSignalrService);
  private router = inject(Router);

  readonly totalDuration = 6;
  countdown = signal<number>(6);
  isPaused = signal<boolean>(false);
  private timerId: any = null;

  // SVG Circular progress radius & circumference
  readonly circleRadius = 26;
  readonly circumference = 2 * Math.PI * 26;

  strokeDashoffset = computed(() => {
    const elapsed = this.totalDuration - this.countdown();
    return this.circumference - (this.circumference * elapsed) / this.totalDuration;
  });

  securitySteps = [
    {
      icon: 'verified_user',
      title: 'Session Securely Closed',
      description: 'Account credentials safely terminated and cleared from memory',
      badge: 'Protected'
    },
    {
      icon: 'phonelink_erase',
      title: 'Device Cache Sanitized',
      description: 'Local session and temporary profile data removed',
      badge: 'Cleared'
    },
    {
      icon: 'sensors_off',
      title: 'Real-Time Channels Closed',
      description: 'Active live communication sockets safely disconnected',
      badge: 'Offline'
    }
  ];

  ngOnInit(): void {
    // 1. Terminate any active SignalR socket connections
    try {
      this.signalrService.stopConnection();
    } catch (e) {
      console.warn('SignalR disconnect notice:', e);
    }

    // 2. Perform clean production session logout through AuthService
    this.authService.logout(false);

    // 3. Clear session storage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage purge notice:', e);
    }

    // 4. Start redirect countdown timer
    this.startTimer();
  }

  private startTimer(): void {
    this.clearTimer();
    this.timerId = setInterval(() => {
      if (!this.isPaused()) {
        const current = this.countdown();
        if (current > 1) {
          this.countdown.set(current - 1);
        } else {
          this.clearTimer();
          this.router.navigate(['/']);
        }
      }
    }, 1000);
  }

  togglePause(): void {
    this.isPaused.update((p) => !p);
  }

  goHome(): void {
    this.clearTimer();
    this.router.navigate(['/']);
  }

  goToLogin(): void {
    this.clearTimer();
    this.router.navigate(['/login']);
  }

  browseServices(): void {
    this.clearTimer();
    this.router.navigate(['/customer-services']);
  }

  private clearTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
