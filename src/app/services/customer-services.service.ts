import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProfessionalProfileServiceDto {
  id: string;
  professionalProfileId: string;
  userId: string;
  professionalName: string;
  professionalHeadline: string | null;
  profilePhotoUrl: string | null;
  overallRating: number;
  completedJobsCount: number;
  isVerified: boolean;
  professionalExperienceYears: number;
  serviceId: string;
  serviceName: string;
  serviceDescription: string | null;
  pricingType: number | string;
  basePrice: number | null;
  customPrice: number | null;
  effectivePrice: number;
  estimatedDurationMins: number | null;
  serviceExperienceYears: number | null;
  categoryId: string;
  categoryName: string;
  categoryIconUrl: string | null;
  distanceKm?: number | null;
  distance?: number | null;
  subCityName?: string | null;
  neighborhoodName?: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export interface CustomerServicesFilterParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string | null;
  isVerified?: boolean | null;
  orderBy?: string;
  descending?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  neighborhoodId?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerServicesService {
  private customerApiUrl = 'http://localhost:5189/api/customer';
  private adminApiUrl = 'http://localhost:5189/api/admin';
  private jobApiUrl = 'http://localhost:5189/api/job';

  constructor(private http: HttpClient) {}

  /**
   * Get paginated professional services list with filtering, GPS proximity search, and neighborhood lookup
   * GET /api/customer/services/paged
   */
  getProfessionalServices(params: CustomerServicesFilterParams): Observable<PagedResponse<ProfessionalProfileServiceDto>> {
    let httpParams = new HttpParams();

    if (params.page !== undefined && params.page !== null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize !== undefined && params.pageSize !== null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    if (params.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params.isVerified !== undefined && params.isVerified !== null) {
      httpParams = httpParams.set('isVerified', params.isVerified.toString());
    }
    if (params.orderBy) {
      httpParams = httpParams.set('orderBy', params.orderBy);
    }
    if (params.descending !== undefined && params.descending !== null) {
      httpParams = httpParams.set('descending', params.descending.toString());
    }
    if (params.latitude !== undefined && params.latitude !== null) {
      httpParams = httpParams.set('latitude', params.latitude.toString());
    }
    if (params.longitude !== undefined && params.longitude !== null) {
      httpParams = httpParams.set('longitude', params.longitude.toString());
    }
    if (params.radiusKm !== undefined && params.radiusKm !== null) {
      httpParams = httpParams.set('radiusKm', params.radiusKm.toString());
    }
    if (params.neighborhoodId !== undefined && params.neighborhoodId !== null) {
      httpParams = httpParams.set('neighborhoodId', params.neighborhoodId.toString());
    }

    return this.http.get<PagedResponse<ProfessionalProfileServiceDto>>(`${this.customerApiUrl}/services/paged`, {
      params: httpParams
    });
  }

  /**
   * Fetch all service categories for category filter buttons
   */
  getCategories(): Observable<any[]> {
    return new Observable<any[]>((observer) => {
      this.http.get<any>(`${this.customerApiUrl}/service-categories?pageSize=100`).subscribe({
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
          this.http.get<any>(`${this.adminApiUrl}/service-categories`).subscribe({
            next: (admRes) => {
              if (Array.isArray(admRes)) {
                observer.next(admRes);
              } else if (admRes && Array.isArray(admRes.items)) {
                observer.next(admRes.items);
              } else {
                observer.next([]);
              }
              observer.complete();
            },
            error: () => {
              observer.next([]);
              observer.complete();
            }
          });
        }
      });
    });
  }

  /**
   * Customer initiates a job request / booking (Status: Draft)
   */
  createJob(jobDto: any): Observable<any> {
    return this.http.post(`${this.jobApiUrl}/create`, jobDto);
  }

  // ==========================================
  // CUSTOMER PROFILE & FAVORITES
  // ==========================================

  /**
   * Fetch authenticated customer's own profile using Bearer Token
   */
  getCustomerProfile(): Observable<any> {
    return this.http.get<any>(`${this.customerApiUrl}/profile`);
  }

  /**
   * Upload customer profile photo (multipart/form-data)
   * POST /api/customer/profile/photo
   */
  uploadProfilePhoto(file: File): Observable<{ message: string; profilePhotoUrl: string; profile: any }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; profilePhotoUrl: string; profile: any }>(
      `${this.customerApiUrl}/profile/photo`,
      formData
    );
  }

  /**
   * Update Customer Profile Details
   * PUT /api/customer/profile
   */
  updateProfile(profileDto: { firstName?: string; lastName?: string; phone?: string; profilePhotoUrl?: string }): Observable<any> {
    return this.http.put(`${this.customerApiUrl}/profile`, profileDto);
  }

  /**
   * Bookmark / Add Service to Favorites
   */
  addFavoriteService(customerId: string, serviceId: string): Observable<any> {
    return this.http.post(`${this.customerApiUrl}/favorite-service`, {
      customerId,
      serviceId
    });
  }

  /**
   * Get Customer's Favorite Services (Via Token: GET /api/customer/favorite-services, or by ID: /favorite-services/{customerId})
   */
  getFavoriteServices(customerId?: string): Observable<any[]> {
    const url = customerId
      ? `${this.customerApiUrl}/favorite-services/${customerId}`
      : `${this.customerApiUrl}/favorite-services`;
    return this.http.get<any[]>(url);
  }

  /**
   * Bookmark / Add Professional to Favorites
   */
  addFavoriteProfessional(customerId: string, professionalProfileId: string): Observable<any> {
    return this.http.post(`${this.customerApiUrl}/favorite-professional`, {
      customerId,
      professionalProfileId
    });
  }

  /**
   * Get Customer's Favorite Professionals (Via Token: GET /api/customer/favorite-professionals, or by ID: /favorite-professionals/{customerId})
   */
  getFavoriteProfessionals(customerId?: string): Observable<any[]> {
    const url = customerId
      ? `${this.customerApiUrl}/favorite-professionals/${customerId}`
      : `${this.customerApiUrl}/favorite-professionals`;
    return this.http.get<any[]>(url);
  }

  /**
   * Remove Favorite Professional (Via Token: DELETE /api/customer/favorite-professional/{profileId}, or by Customer ID: /favorite-professional/{customerId}/{profileId})
   */
  removeFavoriteProfessional(profileId: string, customerId?: string): Observable<any> {
    const url = customerId
      ? `${this.customerApiUrl}/favorite-professional/${customerId}/${profileId}`
      : `${this.customerApiUrl}/favorite-professional/${profileId}`;
    return this.http.delete(url);
  }

  /**
   * Remove Favorite Service (Via Token: DELETE /api/customer/favorite-service/{serviceId}, or by Customer ID: /favorite-service/{customerId}/{serviceId})
   */
  removeFavoriteService(serviceId: string, customerId?: string): Observable<any> {
    const url = customerId
      ? `${this.customerApiUrl}/favorite-service/${customerId}/${serviceId}`
      : `${this.customerApiUrl}/favorite-service/${serviceId}`;
    return this.http.delete(url);
  }

  /**
   * Fetch customer reviews via GET /api/customer/reviews/{id} or GET /api/customer/reviews
   */
  getReviews(id?: string): Observable<any[]> {
    const url = id ? `${this.customerApiUrl}/reviews/${id}` : `${this.customerApiUrl}/reviews`;
    return this.http.get<any[]>(url);
  }

  /**
   * Submit Report Abuse / Issue regarding app usage
   * POST /api/customer/report-abuse
   */
  reportAbuse(dto: { category?: string; reason: string; details?: string; reportedUserId?: string }): Observable<any> {
    return this.http.post(`${this.customerApiUrl}/report-abuse`, dto);
  }
}
