import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class JobService {
  private baseUrl = 'http://localhost:5189/api/job';

  constructor(private http: HttpClient) {}

  /**
   * Fetch assigned jobs for a given professional from the backend
   */
  getAssignedJobs(professionalId: string): Observable<ProJob[]> {
    return this.http.get<ProJob[]>(`${this.baseUrl}/professional/${professionalId}`);
  }

  /**
   * Fetch all jobs assigned to a professional
   */
  getJobsByProfessional(professionalId: string): Observable<ProJob[]> {
    return this.http.get<ProJob[]>(`${this.baseUrl}/professional/${professionalId}`);
  }

  /**
   * Fetch job details by Job ID
   */
  getJobById(jobId: string): Observable<ProJob> {
    return this.http.get<ProJob>(`${this.baseUrl}/${jobId}`);
  }

  /**
   * Fetch jobs created by a customer
   */
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
