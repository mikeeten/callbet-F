import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WorkflowJobData } from './job-workflow.types';
import { JobService } from '../services/job.service';

@Component({
  selector: 'app-job-step3-progress',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './job-step3-progress.component.html',
  styleUrls: ['./job-step3-progress.component.scss']
})
export class JobStep3ProgressComponent implements OnInit, OnDestroy {
  @Input({ required: true }) jobData!: WorkflowJobData;
  @Output() workCompleted = new EventEmitter<WorkflowJobData>();

  private jobService = inject(JobService);

  loading = signal(false);
  hasStarted = signal(true);
  elapsedSeconds = signal(1420); // ~23 mins simulated initial time
  private timerInterval: any;

  checklist = signal([
    { id: 1, text: 'Technician arrived on-site and presented credentials', done: true },
    { id: 2, text: 'Initial diagnostics and safety hazard assessment', done: true },
    { id: 3, text: 'Core service execution and equipment calibration', done: true },
    { id: 4, text: 'Post-service cleanup and functionality testing', done: false }
  ]);

  ngOnInit(): void {
    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  get formattedTime(): string {
    const total = this.elapsedSeconds();
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  toggleCheck(id: number): void {
    this.checklist.update((items) =>
      items.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
    );
  }

  onCompleteWork(): void {
    this.loading.set(true);
    const jobId = this.jobData.jobId || 'job-' + Date.now();

    this.jobService.startJob(jobId).subscribe({
      next: () => this.finishWork(),
      error: () => this.finishWork()
    });
  }

  private finishWork(): void {
    this.loading.set(false);
    const updatedData: WorkflowJobData = {
      ...this.jobData,
      status: 'CompletedPendingApproval',
      timerSeconds: this.elapsedSeconds()
    };
    this.workCompleted.emit(updatedData);
  }
}
