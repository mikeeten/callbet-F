import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface JobDto {
  customerId?: string | null;
  professionalId?: string | null;
  serviceId?: string | null;
  description: string;
  addressId?: string | null;
  scheduledDateTime?: string | null;
  estimatedDurationMins?: number | null;
  price?: number | null;
}

export interface JobResponse {
  message: string;
  id: string;
}

export interface ProJob {
  id: string;
  serviceName: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId: string;
  status: 'Assigned' | 'InProgress' | 'CompletedPendingApproval' | 'Closed' | 'Cancelled';
  price: number;
  netPayout?: number;
  platformFee?: number;
  scheduledDate: string;
  address: string;
  street?: string;
  landmark?: string;
  neighborhood?: string;
  subCity?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  description: string;
}

export interface PagedJobResponse {
  items: ProJob[];
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
export class JobService {
  private baseUrl = 'http://localhost:5189/api/job';

  constructor(private http: HttpClient) {}

  /**
   * Fetch assigned jobs with server-side pagination, search, and status filtering
   */
  getAssignedJobsPaged(
    professionalId: string,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: string;
      orderBy?: string;
      descending?: boolean;
    }
  ): Observable<PagedJobResponse> {
    let httpParams = new HttpParams();
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status && params.status !== 'all') httpParams = httpParams.set('status', params.status);
    if (params?.orderBy) httpParams = httpParams.set('orderBy', params.orderBy);
    if (params?.descending !== undefined) httpParams = httpParams.set('descending', params.descending.toString());

    return this.http.get<any>(`${this.baseUrl}/professional/${professionalId}`, { params: httpParams }).pipe(
      map((res) => {
        const rawItems = Array.isArray(res) ? res : (res?.items || []);
        const items: ProJob[] = rawItems.map((j: any) => ({
          id: j.id,
          serviceName: j.serviceName || 'Home Service',
          customerName: j.customerName || 'Customer',
          customerPhone: j.customerPhone,
          customerEmail: j.customerEmail,
          customerId: j.customerId,
          status: (j.status === 'Created' ? 'Assigned' : j.status) as any,
          price: j.price || 0,
          netPayout: j.netPayout ?? Math.round((j.price || 0) * 0.85 * 100) / 100,
          platformFee: j.platformFee ?? Math.round((j.price || 0) * 0.15 * 100) / 100,
          scheduledDate: j.scheduledDate || '',
          address: j.address || '',
          street: j.street,
          city: j.city,
          neighborhood: j.neighborhood,
          subCity: j.subCity,
          latitude: j.latitude,
          longitude: j.longitude,
          description: j.description || ''
        }));

        const totalCount = res?.totalCount ?? items.length;
        const page = res?.page ?? (params?.page || 1);
        const pageSize = res?.pageSize ?? (params?.pageSize || 10);
        const totalPages = res?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

        return {
          items,
          totalCount,
          page,
          pageSize,
          totalPages,
          hasPrevious: page > 1,
          hasNext: page < totalPages
        };
      })
    );
  }

  /**
   * Fetch assigned jobs for a given professional from the backend (backward compatibility)
   */
  getAssignedJobs(professionalId: string): Observable<ProJob[]> {
    return this.http.get<any>(`${this.baseUrl}/professional/${professionalId}?pageSize=100`).pipe(
      map((res) => {
        const rawItems = Array.isArray(res) ? res : (res?.items || []);
        return rawItems.map((j: any) => ({
          id: j.id,
          serviceName: j.serviceName || 'Home Service',
          customerName: j.customerName || 'Customer',
          customerPhone: j.customerPhone,
          customerEmail: j.customerEmail,
          customerId: j.customerId,
          status: (j.status === 'Created' ? 'Assigned' : j.status) as any,
          price: j.price || 0,
          netPayout: j.netPayout ?? Math.round((j.price || 0) * 0.85 * 100) / 100,
          platformFee: j.platformFee ?? Math.round((j.price || 0) * 0.15 * 100) / 100,
          scheduledDate: j.scheduledDate || '',
          address: j.address || '',
          street: j.street,
          city: j.city,
          neighborhood: j.neighborhood,
          subCity: j.subCity,
          latitude: j.latitude,
          longitude: j.longitude,
          description: j.description || ''
        }));
      })
    );
  }

  /**
   * Fetch all jobs assigned to a professional
   */
  getJobsByProfessional(professionalId: string): Observable<ProJob[]> {
    return this.getAssignedJobs(professionalId);
  }

  /**
   * Fetch job details by Job ID
   */
  getJobById(jobId: string): Observable<ProJob> {
    return this.http.get<ProJob>(`${this.baseUrl}/${jobId}`);
  }

  /**
   * Fetch all booked jobs for the current logged-in user (Customer or Professional via JWT)
   */
  getMyJobs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/my-jobs`);
  }

  getJobsByCustomer(customerId: string): Observable<ProJob[]> {
    return this.http.get<ProJob[]>(`${this.baseUrl}/customer/${customerId}`);
  }

  /**
   * Create a new job
   */
  createJob(dto: JobDto): Observable<JobResponse> {
    return this.http.post<JobResponse>(`${this.baseUrl}/create`, dto);
  }

  /**
   * Assign a professional to a job
   */
  assignProfessional(jobId: string, professionalId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/assign/${jobId}`, JSON.stringify(professionalId), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Start a job
   */
  startJob(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/start/${jobId}`, {});
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/complete/${jobId}`, {});
  }

  /**
   * Close a job
   */
  closeJob(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/close/${jobId}`, {});
  }

  /**
   * Cancel a job (by customer or professional)
   */
  cancelJob(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/cancel/${jobId}`, {});
  }

  /**
   * Delete / Remove a job from history
   */
  deleteJob(jobId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${jobId}`);
  }

  /**
   * Create payment for a job
   */
  createPayment(dto: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/payment`, dto);
  }

  /**
   * Hold payment in escrow
   */
  holdPayment(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/payment/escrow/${jobId}`, {});
  }

  /**
   * Release payment to worker
   */
  releasePayment(jobId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/payment/release/${jobId}`, {});
  }

  /**
   * Create review for a job
   */
  createReview(dto: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/review`, dto);
  }

  /**
   * Reply to a review
   */
  replyToReview(dto: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/review/reply`, dto);
  }
}
