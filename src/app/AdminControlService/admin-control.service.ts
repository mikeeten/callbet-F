import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminControlService {
  private baseUrl = 'http://localhost:5189/api';
  private baseUrlo = 'http://localhost:5189/api/admin';

  constructor(private http: HttpClient) {}

  // Upload verification document (JSON/URL)
  uploadVerification(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/verification/upload`, data);
  }

  // Upload verification document with actual file (multipart/form-data)
  uploadVerificationWithDocument(documentType: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/verification/with-document`, formData);
  }

  // Fetch pending verifications
  getPendingVerifications(): Observable<any> {
    return this.http.get(`${this.baseUrl}/verification/pending`);
  }

  getVerificationRecords(params: any): Observable<any> {
  return this.http.get(`${this.baseUrl}/verification`, { params });
  }

  // Approve verification
  approveVerification(recordId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/verification/approve/${recordId}`, {});
  }

  // Delete verification
  deleteVerification(recordId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/verification/delete/${recordId}`);
  }

   getUsers(params: any): Observable<any> {
    return this.http.get(`${this.baseUrlo}/users`, { params });
   }

  getProfessionalProfiles(params: any): Observable<any> {
    return this.http.get(`${this.baseUrlo}/professional-profiles`, { params });
  }

  toggleVerifyProfessional(userId: string): Observable<any> {
    return this.http.put(`${this.baseUrlo}/toggle-verify/${userId}`, {});
  }

  getPendingProfessionals(): Observable<any> {
    return this.http.get(`${this.baseUrlo}/pending-professionals`);
  }

  suspendProfessional(userId: string): Observable<any> {
    return this.http.put(`${this.baseUrlo}/suspend/${userId}`, {});
  }

  activateUser(userId: string): Observable<any> {
    return this.http.put(`${this.baseUrlo}/activate/${userId}`, {});
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.baseUrlo}/delete/${userId}`);
  }

  createServiceCategory(data: any): Observable<any> {
    return this.http.post(`${this.baseUrlo}/service-category`, data);
  }

  getServiceCategories(): Observable<any[]> {
    return new Observable<any[]>((observer) => {
      this.http.get<any>(`${this.baseUrlo}/service-categories`).subscribe({
        next: (res) => {
          if (Array.isArray(res)) {
            observer.next(res);
          } else if (res && Array.isArray(res.items)) {
            observer.next(res.items);
          } else {
            observer.next([]);
          }
          observer.complete();
        },
        error: () => {
          this.http.get<any>(`${this.baseUrl}/customer/service-categories?pageSize=100`).subscribe({
            next: (cRes) => {
              if (Array.isArray(cRes)) {
                observer.next(cRes);
              } else if (cRes && Array.isArray(cRes.items)) {
                observer.next(cRes.items);
              } else {
                observer.next([]);
              }
              observer.complete();
            },
            error: (err) => {
              observer.error(err);
            }
          });
        }
      });
    });
  }

  createService(data: any): Observable<any> {
    return this.http.post(`${this.baseUrlo}/service`, data);
  }

  getServicesByCategory(categoryId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrlo}/services/${categoryId}`);
  }

  // Content Moderation (with server-side filtering & pagination)
  getModerationReviews(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    orderBy?: string;
    descending?: boolean;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page !== undefined && params.page !== null) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.pageSize !== undefined && params.pageSize !== null) {
        httpParams = httpParams.set('pageSize', params.pageSize.toString());
      }
      if (params.search && params.search.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      if (params.status && params.status !== 'all') {
        httpParams = httpParams.set('status', params.status);
      }
      if (params.orderBy) {
        httpParams = httpParams.set('orderBy', params.orderBy);
      }
      if (params.descending !== undefined) {
        httpParams = httpParams.set('descending', params.descending.toString());
      }
    }
    return this.http.get<any>(`${this.baseUrlo}/moderation/reviews`, { params: httpParams });
  }

  dismissReviewFlag(reviewId: string): Observable<any> {
    return this.http.put(`${this.baseUrlo}/moderation/reviews/${reviewId}/dismiss`, {});
  }

  deleteReview(reviewId: string): Observable<any> {
    return this.http.delete(`${this.baseUrlo}/review/${reviewId}`);
  }

  // Service Zones
  getServiceZones(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrlo}/service-zones`);
  }

  createServiceZone(data: { subCity?: string; subCityId?: number; neighborhood: string }): Observable<any> {
    return this.http.post(`${this.baseUrlo}/service-zones`, data);
  }

  deleteServiceZone(zoneId: number | string): Observable<any> {
    return this.http.delete(`${this.baseUrlo}/service-zones/${zoneId}`);
  }

  getSubCities(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/location/subcities`);
  }

  // Reports & Disputes (with server-side filtering & pagination)
  getReports(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    role?: string;
    orderBy?: string;
    descending?: boolean;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page !== undefined && params.page !== null) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.pageSize !== undefined && params.pageSize !== null) {
        httpParams = httpParams.set('pageSize', params.pageSize.toString());
      }
      if (params.search && params.search.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      if (params.status && params.status !== 'all') {
        httpParams = httpParams.set('status', params.status);
      }
      if (params.role && params.role !== 'all') {
        httpParams = httpParams.set('role', params.role);
      }
      if (params.orderBy) {
        httpParams = httpParams.set('orderBy', params.orderBy);
      }
      if (params.descending !== undefined) {
        httpParams = httpParams.set('descending', params.descending.toString());
      }
    }
    return this.http.get<any>(`${this.baseUrlo}/reports`, { params: httpParams });
  }

  resolveReport(reportId: string): Observable<any> {
    return this.http.put(`${this.baseUrlo}/reports/${reportId}/resolve`, {});
  }

  deleteReport(reportId: string): Observable<any> {
    return this.http.delete(`${this.baseUrlo}/reports/${reportId}`);
  }

  getFinancialOverview(): Observable<any> {
    return this.http.get<any>(`${this.baseUrlo}/financial-overview`);
  }
}
