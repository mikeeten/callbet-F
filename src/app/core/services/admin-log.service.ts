import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminLogDto {
  id: string;
  adminUserId: string;
  adminName?: string;
  adminEmail?: string;
  action: string;
  targetEntity?: string;
  targetEntityId?: string;
  timestamp: string;
}

export interface PagedResponse<T> {
  items: T[];
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
export class AdminLogService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5189/api/admin';

  getLogs(page = 1, pageSize = 20, search = ''): Observable<PagedResponse<AdminLogDto>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<PagedResponse<AdminLogDto>>(`${this.baseUrl}/logs`, { params });
  }
}
