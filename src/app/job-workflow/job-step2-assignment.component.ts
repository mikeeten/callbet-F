import { Component, Input, Output, EventEmitter, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkflowJobData } from './job-workflow.types';
import { JobService } from '../services/job.service';

export interface AssignedProfessional {
  id: string;
  name: string;
  avatar: string;
  headline: string;
  rating: number;
  completedJobs: number;
  experienceYears: number;
  phone: string;
  eta: string;
  isVerified: boolean;
}

@Component({
  selector: 'app-job-step2-assignment',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './job-step2-assignment.component.html',
  styleUrls: ['./job-step2-assignment.component.scss']
})
export class JobStep2AssignmentComponent implements OnInit {
  @Input({ required: true }) jobData!: WorkflowJobData;
  @Output() assignmentConfirmed = new EventEmitter<WorkflowJobData>();

  private jobService = inject(JobService);

  loading = signal(false);
  selectedProId = signal<string>('09a41aeb-4e62-4f5f-b994-fc965117be83');

  availablePros: AssignedProfessional[] = [
    {
      id: '09a41aeb-4e62-4f5f-b994-fc965117be83',
      name: 'Tenagasha Wollela',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      headline: 'Certified Master Electrician & Deep Cleaning Specialist',
      rating: 4.95,
      completedJobs: 148,
      experienceYears: 9,
      phone: '+251 92 345 6789',
      eta: '15-20 mins away',
      isVerified: true
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Yared Solomon',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      headline: 'Senior Plumbing & Drainage Engineer',
      rating: 4.88,
      completedJobs: 112,
      experienceYears: 7,
      phone: '+251 91 122 3344',
      eta: '25 mins away',
      isVerified: true
    }
  ];

  ngOnInit(): void {
    if (this.jobData.professionalProfileId) {
      this.selectedProId.set(this.jobData.professionalProfileId);
    }
  }

  selectPro(proId: string): void {
    this.selectedProId.set(proId);
  }

  onAssign(): void {
    this.loading.set(true);
    const pro = this.availablePros.find((p) => p.id === this.selectedProId()) || this.availablePros[0];
    const jobId = this.jobData.jobId || 'job-' + Date.now();

    this.jobService.assignProfessional(jobId, pro.id).subscribe({
      next: () => {
        this.loading.set(false);
        const updatedData: WorkflowJobData = {
          ...this.jobData,
          jobId,
          professionalProfileId: pro.id,
          professionalName: pro.name,
          professionalAvatar: pro.avatar,
          professionalHeadline: pro.headline,
          professionalRating: pro.rating,
          status: 'Assigned'
        };
        this.assignmentConfirmed.emit(updatedData);
      },
      error: () => {
        this.loading.set(false);
        const updatedData: WorkflowJobData = {
          ...this.jobData,
          jobId,
          professionalProfileId: pro.id,
          professionalName: pro.name,
          professionalAvatar: pro.avatar,
          professionalHeadline: pro.headline,
          professionalRating: pro.rating,
          status: 'Assigned'
        };
        this.assignmentConfirmed.emit(updatedData);
      }
    });
  }
}
