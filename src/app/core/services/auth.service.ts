import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  profilePhotoUrl?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  phoneNumber?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePhotoUrl?: string;
  roles?: string[] | string;
  role?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = 'http://localhost:5189/api/auth';

  private readonly ACCESS_TOKEN_KEY = 'callbet_access_token';
  private readonly REFRESH_TOKEN_KEY = 'callbet_refresh_token';
  private readonly USER_KEY = 'callbet_user';

  // Current logged in user signal
  currentUser = signal<User | null>(this.getStoredUser());

  // Reactive authentication state computed from currentUser
  isAuthenticated = computed(() => !!this.currentUser() && !!this.getAccessToken());

  // User roles signal
  userRoles = computed(() => this.currentUser()?.roles || []);

  constructor() {
    // If tokens exist in storage on startup, ensure currentUser is initialized
    const storedUser = this.getStoredUser();
    if (storedUser && this.getAccessToken()) {
      this.currentUser.set(storedUser);
    }
  }

  // ==========================================
  // AUTH API METHODS
  // ==========================================

  /**
   * Log in user with email & password
   */
  login(dto: LoginRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.baseUrl}/login`, dto).pipe(
      tap((res) => {
        if (res && res.accessToken) {
          const rolesArray = this.extractRoles(res);
          const user: User = {
            id: res.userId || 'user-' + Date.now(),
            email: res.email || dto.email,
            firstName: res.firstName || '',
            lastName: res.lastName || '',
            roles: rolesArray
          };
          this.saveTokens(res.accessToken, res.refreshToken, user);
        }
      })
    );
  }

  /**
   * Register new user account
   */
  register(dto: RegisterRequestDto): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/register`, dto).pipe(
      tap((res) => {
        if (res && res.accessToken) {
          const rolesArray = this.extractRoles(res);
          const user: User = {
            id: res.userId || 'user-' + Date.now(),
            email: res.email || dto.email,
            firstName: res.firstName || dto.firstName,
            lastName: res.lastName || dto.lastName,
            roles: rolesArray.length > 0 ? rolesArray : [dto.role || 'Customer']
          };
          this.saveTokens(res.accessToken, res.refreshToken || '', user);
        }
      })
    );
  }

  /**
   * Register new System Administrator account
   * POST /api/auth/register-admin
   */

  registerAdmin(dto: RegisterRequestDto): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/register-admin`, dto).pipe(
      tap((res) => {
        if (res && res.accessToken) {
          const user: User = {
            id: res.userId || 'admin-' + Date.now(),
            email: res.email || dto.email,
            firstName: res.firstName || dto.firstName,
            lastName: res.lastName || dto.lastName,
            roles: ['Admin']
          };
          this.saveTokens(res.accessToken, res.refreshToken || '', user);
        }
      })
    );
  }

  /**
   * Refresh JWT access token using refreshToken
   */
  refreshToken(): Observable<AuthResponseDto> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout(true);
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthResponseDto>(`${this.baseUrl}/refresh`, { refreshToken: refresh }).pipe(
      tap((res) => {
        if (res && res.accessToken) {
          const user = this.currentUser();
          this.saveTokens(res.accessToken, res.refreshToken || refresh, user || undefined);
        }
      }),
      catchError((err) => {
        this.logout(true);
        return throwError(() => err);
      })
    );
  }

  /**
   * Log out user, clear storage and navigate to login
   */
  logout(redirect = true, returnUrl?: string): void {
    this.clearTokens();
    this.currentUser.set(null);

    if (redirect) {
      const queryParams = returnUrl ? { returnUrl } : undefined;
      this.router.navigate(['/login'], { queryParams });
    }
  }

  // ==========================================
  // ROLE & PERMISSION HELPERS
  // ==========================================

  /**
   * Check if current user has a specific role
   */
  hasRole(role: string): boolean {
    const roles = this.userRoles();
    return roles.some((r) => r.toLowerCase() === role.toLowerCase());
  }

  /**
   * Check if current user has any role in the provided list
   */
  hasAnyRole(roles: string[]): boolean {
    if (!roles || roles.length === 0) return true;
    return roles.some((r) => this.hasRole(r));
  }

  /**
   * Get authenticated user's ID from session or decoded JWT Bearer token
   */
  getUserId(): string | null {
    const user = this.currentUser();
    if (user?.id && user.id.length > 5) return user.id;

    const token = this.getAccessToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          return (
            payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
            payload.nameid ||
            payload.sub ||
            payload.id ||
            payload.UserId ||
            null
          );
        }
      } catch (e) {
        console.warn('Failed to parse JWT token for userId', e);
      }
    }
    return null;
  }

  // ==========================================
  // STORAGE HELPERS
  // ==========================================

  getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  saveTokens(accessToken: string, refreshToken: string, user?: User): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
      if (user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      }
    } catch (e) {
      console.error('Failed to save auth tokens to localStorage', e);
    }
  }

  clearTokens(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch (e) {
      console.error('Failed to clear tokens from localStorage', e);
    }
  }

  /**
   * Update active user profile in memory and localStorage
   */
  updateUserProfile(updates: Partial<User>): void {
    const current = this.currentUser();
    if (!current) return;

    const updatedUser: User = {
      ...current,
      ...updates
    };

    try {
      localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
      this.currentUser.set(updatedUser);
    } catch (e) {
      console.error('Failed to update user profile in localStorage', e);
    }
  }

  private getStoredUser(): User | null {
    try {
      const item = localStorage.getItem(this.USER_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  private extractRoles(res: AuthResponseDto): string[] {
    if (Array.isArray(res.roles)) {
      return res.roles;
    }
    if (typeof res.roles === 'string') {
      return [res.roles];
    }
    if (res.role) {
      return [res.role];
    }
    return ['Customer'];
  }
}
