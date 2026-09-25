import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProfessionalService } from '../../ProfessionalService/professional-profile.service';
import { AuthService } from '../core/services/auth.service';

export interface ResumePreset {
  summary: string;
  education: string;
  experience: string;
  skills: string;
  languages: string;
  resumeFileUrl: string;
}

@Component({
  selector: 'app-resume-upload',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './resume-upload.component.html',
  styleUrls: ['./resume-upload.component.scss']
})
export class ResumeUploadComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private professionalService = inject(ProfessionalService);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitting = signal(false);
  uploadSuccess = signal(false);
  uploadError = signal<string | null>(null);
  loadedProfile = signal<any | null>(null);
  isDraggingFile = signal(false);
  private redirectTimer: any = null;

  // Computed Pro Meta for Live Preview
  proDisplayName = computed(() => {
    const p = this.loadedProfile();
    if (p?.fullName || p?.name) return (p.fullName || p.name).trim();
    const auth = this.authService.currentUser();
    if (auth?.firstName || auth?.lastName) return `${auth.firstName || ''} ${auth.lastName || ''}`.trim();
    return 'Verified Trade Professional';
  });

  proAvatarUrl = computed(() => {
    const p = this.loadedProfile();
    const photo = p?.profilePhotoUrl || p?.avatarUrl;
    if (photo) {
      if (photo.startsWith('http') || photo.startsWith('data:')) return photo;
      if (photo.startsWith('/')) return `http://localhost:5189${photo}`;
      return `http://localhost:5189/uploads/${photo}`;
    }
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
  });

  proHeadline = computed(() => {
    const p = this.loadedProfile();
    return p?.headline?.trim() || 'Certified Service Specialist';
  });

  // Quick Skill Suggestions
  popularSkillTags = [
    'Smart Wiring',
    'Breaker Panels',
    'Solar Inverters',
    'Pipe Leak Detection',
    'Sanitary Plumbing',
    'Steam Sanitization',
    'Villa Deep Cleaning',
    'HVAC Diagnostics',
    'Tile Grout Restoration',
    'Generator Maintenance'
  ];

  // Quick Language Suggestions
  popularLanguages = ['Amharic', 'English', 'Afaan Oromoo', 'Tigrinya', 'Arabic', 'Somali'];

  // Sample Resume Profiles for Quick-Fill
  sampleResumes: Record<string, ResumePreset> = {
    electrician: {
      summary: 'Certified Master Electrician with 9+ years of commercial and residential smart wiring, distribution panels, and solar backup system installation.',
      education: 'BSc in Electrical Engineering, Addis Ababa University (2018)',
      experience: 'Lead Field Electrician at Apex Power & Infrastructure (2018 - 2024)',
      skills: 'Smart Wiring, Breaker Panels, Solar Inverters, Circuit Troubleshooting, Surge Protection',
      languages: 'Amharic, English',
      resumeFileUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800'
    },
    cleaner: {
      summary: 'Professional Eco-Cleaning Specialist with 6 years of expertise in hospital-grade deep sanitization, steam upholstery care, and post-construction renewal.',
      education: 'Certified Hygiene & Bio-Sanitation Guild (#ET-2021-44)',
      experience: 'Senior Cleaning Supervisor at CleanPro Services Addis (2020 - 2024)',
      skills: 'Villa Deep Cleaning, Steam Sanitization, Sofa Upholstery, Tile Grout Restoration',
      languages: 'Amharic, English, Afaan Oromoo',
      resumeFileUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800'
    },
    plumber: {
      summary: 'Licensed Master Plumber with 8 years solving high-pressure pipeline emergencies, sanitary fixtures, booster pumps, and water heating systems.',
      education: 'Advanced Diploma in Hydraulic & Sanitary Systems, Tegbare-Id Polytechnic',
      experience: 'Senior Plumbing Specialist at Addis Urban Utilities (2019 - 2024)',
      skills: 'Pipe Leak Detection, Sanitary Plumbing, Water Heaters, Booster Pumps, Drain Descaling',
      languages: 'Amharic, English',
      resumeFileUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156a?w=800'
    },
    hvac: {
      summary: 'Certified HVAC & Appliance Diagnostics Technician specialized in VRF central air, commercial cooling overhauls, and smart heat-pump installations.',
      education: 'National HVAC-R Certification, Ministry of Labor & Skills',
      experience: 'Field Lead at Horn Air Conditioning & Appliance Solutions (2019 - 2024)',
      skills: 'HVAC Diagnostics, Compressor Overhaul, Refrigerant Recovery, Inverter Heat Pumps',
      languages: 'Amharic, English, Tigrinya',
      resumeFileUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800'
    }
  };

  selectedFile = signal<File | null>(null);
  isUploadingPdf = signal(false);

  resumeForm = this.fb.group({
    summary: ['', [Validators.required, Validators.maxLength(500)]],
    educationJson: ['', Validators.required],
    experienceJson: ['', Validators.required],
    skills: ['', Validators.required],
    languages: ['', Validators.required],
    resumeFileUrl: ['', Validators.required]
  });

  ngOnInit(): void {
    // Automatically fetch logged in professional's profile
    this.professionalService.getMyProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.loadedProfile.set(profile);
          if (profile.resume) {
            const r = profile.resume;
            this.resumeForm.patchValue({
              summary: r.summary || '',
              educationJson: r.educationJson ? this.formatJsonArray(r.educationJson) : '',
              experienceJson: r.experienceJson ? this.formatJsonArray(r.experienceJson) : '',
              skills: Array.isArray(r.skills) ? r.skills.join(', ') : r.skills || '',
              languages: Array.isArray(r.languages) ? r.languages.join(', ') : r.languages || '',
              resumeFileUrl: r.resumeFileUrl || ''
            });
          }
        }
      },
      error: () => {}
    });
  }

  private formatJsonArray(val: any): string {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.join('; ');
        return val;
      } catch {
        return val;
      }
    }
    if (Array.isArray(val)) return val.join('; ');
    return String(val || '');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  handleFile(file: File): void {
    const allowedExts = ['.pdf', '.docx', '.doc'];
    const isAllowed = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type === 'application/pdf';

    if (!isAllowed) {
      this.uploadError.set('Please select a valid document (.pdf, .docx, .doc).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('File size must not exceed 10MB.');
      return;
    }

    this.selectedFile.set(file);
    this.uploadError.set(null);

    // Auto-upload file to get immediate URL
    this.isUploadingPdf.set(true);
    this.professionalService.uploadResumePdf(file).subscribe({
      next: (res) => {
        this.isUploadingPdf.set(false);
        this.resumeForm.patchValue({
          resumeFileUrl: res.resumeFileUrl
        });
      },
      error: () => {
        this.isUploadingPdf.set(false);
        // Set fallback file name for demo
        this.resumeForm.patchValue({
          resumeFileUrl: 'uploads/resumes/' + file.name
        });
      }
    });
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.resumeForm.patchValue({ resumeFileUrl: '' });
  }

  applyPreset(presetKey: string): void {
    const preset = this.sampleResumes[presetKey];
    if (preset) {
      this.selectedFile.set(null);
      this.resumeForm.patchValue({
        summary: preset.summary,
        educationJson: preset.education,
        experienceJson: preset.experience,
        skills: preset.skills,
        languages: preset.languages,
        resumeFileUrl: preset.resumeFileUrl
      });
    }
  }

  isSkillSelected(skill: string): boolean {
    const current = this.resumeForm.get('skills')?.value || '';
    const skillsList = current.split(',').map(s => s.trim().toLowerCase());
    return skillsList.includes(skill.toLowerCase());
  }

  toggleSkillTag(skill: string): void {
    const current = this.resumeForm.get('skills')?.value || '';
    let skillsList = current.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const idx = skillsList.findIndex(s => s.toLowerCase() === skill.toLowerCase());
    if (idx >= 0) {
      skillsList.splice(idx, 1);
    } else {
      skillsList.push(skill);
    }
    this.resumeForm.patchValue({ skills: skillsList.join(', ') });
  }

  removeSkill(skill: string): void {
    const current = this.resumeForm.get('skills')?.value || '';
    const skillsList = current.split(',').map(s => s.trim()).filter(s => s.length > 0 && s.toLowerCase() !== skill.toLowerCase());
    this.resumeForm.patchValue({ skills: skillsList.join(', ') });
  }

  isLanguageSelected(lang: string): boolean {
    const current = this.resumeForm.get('languages')?.value || '';
    const langList = current.split(',').map(l => l.trim().toLowerCase());
    return langList.includes(lang.toLowerCase());
  }

  toggleLanguageTag(lang: string): void {
    const current = this.resumeForm.get('languages')?.value || '';
    let langList = current.split(',').map(l => l.trim()).filter(l => l.length > 0);
    const idx = langList.findIndex(l => l.toLowerCase() === lang.toLowerCase());
    if (idx >= 0) {
      langList.splice(idx, 1);
    } else {
      langList.push(lang);
    }
    this.resumeForm.patchValue({ languages: langList.join(', ') });
  }

  removeLanguage(lang: string): void {
    const current = this.resumeForm.get('languages')?.value || '';
    const langList = current.split(',').map(l => l.trim()).filter(l => l.length > 0 && l.toLowerCase() !== lang.toLowerCase());
    this.resumeForm.patchValue({ languages: langList.join(', ') });
  }

  // Parse skills as array for preview
  getParsedSkills(): string[] {
    const raw = this.resumeForm.get('skills')?.value || '';
    return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  // Parse languages as array for preview
  getParsedLanguages(): string[] {
    const raw = this.resumeForm.get('languages')?.value || '';
    return raw.split(',').map(l => l.trim()).filter(l => l.length > 0);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
    }
  }

  continueToCertificates(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
    this.router.navigate(['/certificate-upload']);
  }

  onSubmit(): void {
    if (this.resumeForm.valid) {
      this.submitting.set(true);
      this.uploadSuccess.set(false);
      this.uploadError.set(null);

      const formValue = this.resumeForm.value;
      const file = this.selectedFile();

      const skillsArr = (formValue.skills ?? '').split(',').map(s => s.trim()).filter(s => s.length > 0);
      const languagesArr = (formValue.languages ?? '').split(',').map(l => l.trim()).filter(l => l.length > 0);
      const eduJson = JSON.stringify([formValue.educationJson]);
      const expJson = JSON.stringify([formValue.experienceJson]);

      const onComplete = () => {
        this.submitting.set(false);
        this.uploadSuccess.set(true);
        // 🚀 Auto redirect to Step 3: Certificate Upload
        this.redirectTimer = setTimeout(() => {
          this.router.navigate(['/certificate-upload']);
        }, 1400);
      };

      if (file) {
        this.professionalService.uploadResumeWithDocument(
          formValue.summary!,
          skillsArr,
          languagesArr,
          eduJson,
          expJson,
          file
        ).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            // Fallback to JSON update
            const resumeData = {
              summary: formValue.summary,
              educationJson: eduJson,
              experienceJson: expJson,
              skills: skillsArr,
              languages: languagesArr,
              resumeFileUrl: formValue.resumeFileUrl
            };
            this.professionalService.uploadResume(resumeData).subscribe({
              next: () => {
                onComplete();
              },
              error: (e) => {
                this.submitting.set(false);
                this.uploadError.set(e?.error?.message || 'Resume upload failed. Please verify your authentication.');
              }
            });
          }
        });
      } else {
        const resumeData = {
          summary: formValue.summary,
          educationJson: eduJson,
          experienceJson: expJson,
          skills: skillsArr,
          languages: languagesArr,
          resumeFileUrl: formValue.resumeFileUrl
        };

        this.professionalService.uploadResume(resumeData).subscribe({
          next: () => {
            onComplete();
          },
          error: (err) => {
            this.submitting.set(false);
            this.uploadError.set(err?.error?.message || 'Resume upload failed. Please verify your authentication.');
          }
        });
      }
    }
  }
}
