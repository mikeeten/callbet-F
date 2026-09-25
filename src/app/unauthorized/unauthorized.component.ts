import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="unauthorized-container">
      <mat-card appearance="outlined" class="unauthorized-card">
        <div class="shield-icon-wrap">
          <mat-icon>gpp_bad</mat-icon>
        </div>

        <h2>403 - Access Restricted</h2>
        <p class="desc">
          @if (isCustomer()) {
            You are signed in as a <strong>Customer</strong>. The Professional Dashboard and technician tools are restricted to verified Service Providers.
          } @else if (isProfessional()) {
            You are signed in as a <strong>Professional</strong>. The Customer Dashboard is restricted to platform clients.
          } @else {
            You do not have the required role or permissions to access this page. Please switch accounts or navigate to your assigned hub.
          }
        </p>

        @if (authService.currentUser(); as user) {
          <div class="current-user-box">
            <span class="lbl">Signed in as:</span>
            <strong>{{ user.email }}</strong>
            <div class="roles-strip">
              <span>Account Role:</span>
              @for (r of user.roles; track r) {
                <span class="role-badge" [ngClass]="'role-' + r.toLowerCase()">{{ r }}</span>
              }
            </div>
          </div>
        }

        <div class="actions-row">
          @if (userDashboardLink()) {
            <a mat-raised-button color="primary" [routerLink]="userDashboardLink()">
              <mat-icon>dashboard</mat-icon> {{ userDashboardLabel() }}
            </a>
          }
          <a mat-stroked-button color="primary" routerLink="/">
            <mat-icon>home</mat-icon> Return to Home
          </a>
          <button mat-stroked-button color="warn" (click)="authService.logout(true)">
            <mat-icon>logout</mat-icon> Switch Account
          </button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 70vh;
      padding: 2rem;
    }
    .unauthorized-card {
      max-width: 540px;
      width: 100%;
      text-align: center;
      padding: 2.5rem 2rem;
      border-radius: 14px;
      border: 1px solid #fee2e2;
      background: #fff;
      box-shadow: 0 10px 25px rgba(239, 68, 68, 0.08);
    }
    .shield-icon-wrap {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 42px; width: 42px; height: 42px; }
    }
    h2 { color: #1e293b; margin: 0 0 0.5rem; font-weight: 700; }
    .desc { color: #64748b; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1.5rem; }
    .current-user-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      text-align: left;
      font-size: 0.85rem;
      .lbl { color: #64748b; margin-right: 4px; }
      .roles-strip {
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        .role-badge {
          background: #e0e7ff;
          color: #3730a3;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.75rem;

          &.role-customer {
            background: #dbeafe;
            color: #1e40af;
          }
          &.role-professional {
            background: #fef3c7;
            color: #92400e;
          }
          &.role-admin {
            background: #fee2e2;
            color: #991b1b;
          }
        }
      }
    }
    .actions-row {
      display: flex;
      justify-content: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
  `]
})
export class UnauthorizedComponent {
  public authService = inject(AuthService);

  isCustomer = computed(() => this.authService.hasRole('Customer'));
  isProfessional = computed(() => this.authService.hasRole('Professional'));
  isAdmin = computed(() => this.authService.hasRole('Admin'));

  userDashboardLink = computed(() => {
    if (this.isAdmin()) return '/admin-dashboard';
    if (this.isProfessional()) return '/professional-dashboard';
    if (this.isCustomer()) return '/customer-dashboard';
    return null;
  });

  userDashboardLabel = computed(() => {
    if (this.isAdmin()) return 'Go to Admin Tower';
    if (this.isProfessional()) return 'Go to Professional Hub';
    if (this.isCustomer()) return 'Go to Customer Hub';
    return 'Go to Dashboard';
  });
}
