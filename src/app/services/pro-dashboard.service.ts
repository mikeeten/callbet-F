import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProJob {
  id: string;
  serviceName: string;
  customerName: string;
  customerId: string;
  status: 'Assigned' | 'InProgress' | 'CompletedPendingApproval' | 'Closed';
  price: number;
  netPayout?: number;
  platformFee?: number;
  scheduledDate: string;
  address: string;
  description: string;
}

export interface ProPayment {
  id: string;
  jobId: string;
  serviceName: string;
  grossAmount: number;
  netPayout: number; // 85%
  platformFee: number; // 15%
  status: 'Held in Escrow' | 'Available for Payout' | 'Disbursed';
  date: string;
}

export interface ProReview {
  id: string;
  jobId: string;
  customerName: string;
  serviceName: string;
  rating: number;
  comment: string;
  date: string;
  reply?: {
    id?: string;
    comment: string;
    date: string;
  };
}

export interface ChatMessage {
  id: string;
  chatSessionId: string;
  senderId: string;
  receiverId?: string;
  content: string;
  sentAt?: string;
}

export interface AvailabilityScheduleDto {
  id?: string;
  professionalProfileId?: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  startTime: string; // e.g. "08:00:00"
  endTime: string;   // e.g. "17:00:00"
  isAvailable?: boolean;
}

export interface BaseAddressDto {
  id?: string;
  neighborhoodName?: string;
  subCityName?: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isBaseAddress?: boolean;
  fullAddress?: string;
}

export interface CertificateDto {
  id: string;
  professionalProfileId?: string;
  title: string;
  organization: string;
  issueDate: string;
  expiryDate?: string;
  documentImageUrl?: string;
  documentUrl?: string;
}

export interface PortfolioItemDto {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  dateCompleted?: string;
}

export interface ProfessionalProfileServiceDto {
  id: string;
  professionalProfileId: string;
  userId?: string;
  professionalName?: string;
  professionalHeadline?: string;
  profilePhotoUrl?: string;
  overallRating?: number;
  completedJobsCount?: number;
  isVerified?: boolean;
  professionalExperienceYears?: number;
  serviceId: string;
  serviceName: string;
  name?: string; // alias for template resilience
  serviceDescription?: string;
  description?: string; // alias for template resilience
  pricingType?: string | number;
  basePrice?: number;
  customPrice?: number;
  effectivePrice?: number;
  price?: number;
  estimatedDurationMins?: number;
  serviceExperienceYears?: number;
  experienceYears?: number;
  categoryId?: string;
  categoryName?: string;
  categoryIconUrl?: string;
}

export interface ServiceDto {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  price?: number;
  pricingType?: string;
  categoryId?: string;
  categoryName?: string;
}

export interface EducationItemDto {
  degree?: string;
  institution?: string;
  year?: string;
  fieldOfStudy?: string;
}

export interface ExperienceItemDto {
  position?: string;
  company?: string;
  duration?: string;
  description?: string;
}

export interface ResumeDto {
  id?: string;
  summary?: string;
  skills?: string[];
  languages?: string[];
  educationJson?: string;
  experienceJson?: string;
  resumeFileUrl?: string;
  education?: EducationItemDto[];
  experience?: ExperienceItemDto[];
}

export interface ProfessionalProfileDashboardDto {
  id: string;
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
  headline?: string;
  bio?: string;
  serviceRadiusKm: number;
  yearsOfExperience: number;
  overallRating: number;
  completedJobsCount: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  baseAddress?: BaseAddressDto;
  addresses?: BaseAddressDto[];
  resume?: ResumeDto;
  certificates?: CertificateDto[];
  portfolioItems?: PortfolioItemDto[];
  services?: ServiceDto[];
  availabilitySchedules?: AvailabilityScheduleDto[];
  reviews?: ProReview[];
}

@Injectable({
  providedIn: 'root'
})
export class ProDashboardService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5189/api';

  // ==========================================
  // UNIFIED PROFILE DASHBOARD (CQRS Endpoint)
  // ==========================================
  /**
   * 1. Retrieve Authenticated Professional's Dashboard (when id is omitted)
   *    GET /api/professional/professional-profile-dashboard
   * 2. Retrieve Specific Professional's Dashboard by Profile or User ID
   *    GET /api/professional/professional-profile-dashboard/{id}
   */
  unassignService(serviceId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/professional/services/${serviceId}`);
  }

  getProfessionalServices(profileId: string): Observable<ProfessionalProfileServiceDto[]> {
    return this.http.get<ProfessionalProfileServiceDto[]>(`${this.baseUrl}/professional/services/${profileId}`);
  }

  getProfessionalProfileDashboard(id?: string): Observable<ProfessionalProfileDashboardDto> {
    const url = id
      ? `${this.baseUrl}/professional/professional-profile-dashboard/${id}`
      : `${this.baseUrl}/professional/professional-profile-dashboard`;
    return this.http.get<ProfessionalProfileDashboardDto>(url);
  }

  // ==========================================
  // TAB 1: ASSIGNED JOBS
  // ==========================================
  getAssignedJobs(professionalId: string): Observable<ProJob[]> {
    return this.http.get<ProJob[]>(`${this.baseUrl}/job/professional/${professionalId}`);
  }

  startJob(jobId: string): Observable<{ message: string; id: string }> {
    return this.http.put<{ message: string; id: string }>(`${this.baseUrl}/job/start/${jobId}`, {});
  }

  completeJob(jobId: string): Observable<{ message: string; id: string }> {
    return this.http.put<{ message: string; id: string }>(`${this.baseUrl}/job/complete/${jobId}`, {});
  }

  // ==========================================
  // TAB 2: PROFILE & CREDENTIALS & AVAILABILITY
  // ==========================================
  getMyProfile(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/professional/my-profile`);
  }

  updateProfile(profile: { headline?: string; bio?: string; serviceRadiusKm?: number; yearsOfExperience?: number }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/professional/profile`, profile);
  }

  uploadProfilePhoto(file: File): Observable<{ message: string; profilePhotoUrl: string; profile?: any }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; profilePhotoUrl: string; profile?: any }>(
      `${this.baseUrl}/customer/profile/photo`,
      formData
    );
  }

  saveBaseAddress(address: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/customer/address`, address);
  }

  getProfileDetails(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/professional/profile-details/${id}`);
  }

  addAvailabilitySchedule(dto: AvailabilityScheduleDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/professional/availability`, dto);
  }

  getAvailabilitySchedules(profileId?: string): Observable<AvailabilityScheduleDto[]> {
    const url = (profileId && profileId !== 'undefined' && profileId !== 'null' && profileId.length > 0)
      ? `${this.baseUrl}/professional/availability/${profileId}`
      : `${this.baseUrl}/professional/availability`;
    return this.http.get<AvailabilityScheduleDto[]>(url);
  }

  deleteAvailabilitySchedule(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/professional/availability/${id}`);
  }

  // Portfolio Management
  addPortfolioItemWithImage(
    title: string,
    description: string,
    dateCompleted: string,
    file: File
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('dateCompleted', dateCompleted);
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/professional/portfolio/with-image`, formData);
  }

  deletePortfolioItem(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/professional/portfolio/${id}`);
  }

  // Certificate Management
  addCertificateWithDocument(
    title: string,
    organization: string,
    issueDate: string,
    expiryDate: string | null,
    file: File
  ): Observable<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('organization', organization);
    formData.append('issueDate', issueDate);
    if (expiryDate) formData.append('expiryDate', expiryDate);
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/professional/certificate/with-document`, formData);
  }

  deleteCertificate(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/professional/certificate/${id}`);
  }

  // Resume Upload
  uploadResume(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/professional/resume`, data);
  }

  uploadResumePdf(file: File): Observable<{ message: string; resumeFileUrl: string; professionalProfileId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; resumeFileUrl: string; professionalProfileId: string }>(
      `${this.baseUrl}/professional/resume/upload-document`,
      formData
    );
  }

  uploadResumeWithDocument(
    summary: string,
    skills: string[],
    languages: string[],
    educationJson: string,
    experienceJson: string,
    file: File
  ): Observable<any> {
    const formData = new FormData();
    formData.append('summary', summary);
    skills.forEach(s => formData.append('skills', s));
    languages.forEach(l => formData.append('languages', l));
    formData.append('educationJson', educationJson);
    formData.append('experienceJson', experienceJson);
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/professional/resume/with-document`, formData);
  }

  // ==========================================
  // TAB 3: EARNINGS & ESCROW
  // ==========================================
  getPaymentsLedger(professionalId: string): Observable<ProPayment[]> {
    return this.http.get<ProPayment[]>(`${this.baseUrl}/job/payments/professional/${professionalId}`);
  }

  // ==========================================
  // TAB 4: REVIEWS & REPUTATION
  // ==========================================
  getReviews(profileId?: string): Observable<ProReview[]> {
    const url = profileId ? `${this.baseUrl}/customer/reviews/${profileId}` : `${this.baseUrl}/customer/reviews`;
    return this.http.get<ProReview[]>(url);
  }

  replyToReview(reviewId: string, replierId: string, comment: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/professional/review/reply`, {
      reviewId,
      replierId,
      comment
    });
  }

  // ==========================================
  // TAB 5: CHATS & NOTIFICATIONS
  // ==========================================
  getChatSessions(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/chat/sessions/${userId}`);
  }

  getChatMessages(sessionId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/chat/messages/${sessionId}`);
  }

  sendChatMessage(chatSessionId: string, senderId: string, content: string, receiverId?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/chat/message`, {
      chatSessionId,
      senderId,
      receiverId,
      content
    });
  }

  // ==========================================
  // TAB 6: ADMIN OVERSIGHT & AUDIT LOGS
  // ==========================================
  getOversightLogs(page = 1, pageSize = 10): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/logs?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * Submit Report Abuse / Issue regarding app usage
   * POST /api/professional/report-abuse
   */
  reportAbuse(dto: { category?: string; reason: string; details?: string; reportedUserId?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/professional/report-abuse`, dto);
  }
}
