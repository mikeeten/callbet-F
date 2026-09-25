import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProfessionalService {
  private baseUrl = 'http://localhost:5189/api/professional';

  constructor(private http: HttpClient) {}

  /** Fetch the logged-in professional's full profile without needing UUID */
  getMyProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/my-profile`);
  }

  /** Retrieve Authenticated or Specific Professional's Dashboard */
  getProfessionalProfileDashboard(id?: string): Observable<any> {
    const url = id
      ? `${this.baseUrl}/professional-profile-dashboard/${id}`
      : `${this.baseUrl}/professional-profile-dashboard`;
    return this.http.get<any>(url);
  }

  /** Step 1: Create or update professional profile (Auto-associates with logged in user) */
  createProfile(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/profile`, data);
  }

  /** Upload professional profile photo (multipart/form-data) */
  uploadProfilePhoto(file: File): Observable<{ message: string; profilePhotoUrl: string; profile?: any }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; profilePhotoUrl: string; profile?: any }>(
      `http://localhost:5189/api/customer/profile/photo`,
      formData
    );
  }

  /** Step 2: Upload resume (Zero-ID endpoint, uses JWT token) */
  uploadResume(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/resume`, data);
  }

  /** Step 2B: Upload PDF resume directly (multipart/form-data) */
  uploadResumePdf(file: File): Observable<{ message: string; resumeFileUrl: string; professionalProfileId: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message: string; resumeFileUrl: string; professionalProfileId: string }>(
      `${this.baseUrl}/resume/upload-document`,
      formData
    );
  }

  /** Step 2C: Upload PDF resume with metadata in one request (multipart/form-data) */
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

    return this.http.post(`${this.baseUrl}/resume/with-document`, formData);
  }

  /** Step 3: Add certificate (Zero-ID endpoint, uses JWT token) */
  addCertificate(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/certificate`, data);
  }

  /** Step 3B: Add Certificate with direct Document/Image upload (multipart/form-data) */
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

    return this.http.post(`${this.baseUrl}/certificate/with-document`, formData);
  }

  /** Delete certificate by ID */
  deleteCertificate(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/certificate/${id}`);
  }

  /** Step 4: Add portfolio item (Zero-ID endpoint, uses JWT token) */
  addPortfolioItem(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/portfolio`, data);
  }

  /** Step 4B: Add Portfolio Item with direct Image upload (multipart/form-data) */
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

    return this.http.post(`${this.baseUrl}/portfolio/with-image`, formData);
  }

  /** Delete portfolio item by ID */
  deletePortfolioItem(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/portfolio/${id}`);
  }

  /** Step 5: Verification (optional admin action) */
  verifyProfessional(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/verify`, data);
  }

  /** Assign Service to Professional */
  unassignService(serviceId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/services/${serviceId}`);
  }

  assignService(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/assign-service`, data);
  }

  /** Add availability schedule */
  addAvailability(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/availability`, data);
  }

  /** Get availability schedules */
  getAvailability(profileId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/availability/${profileId}`);
  }

  getAvailabilitySchedules(profileId?: string): Observable<any[]> {
    const url = (profileId && profileId !== 'undefined' && profileId !== 'null' && profileId.length > 0)
      ? `${this.baseUrl}/availability/${profileId}`
      : `${this.baseUrl}/availability`;
    return this.http.get<any[]>(url);
  }

  deleteAvailabilitySchedule(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/availability/${id}`);
  }
}
