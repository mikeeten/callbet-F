import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationService } from '../services/notification.service';
import { CustomerServicesService } from '../services/customer-services.service';
import { AuthService } from '../core/services/auth.service';

export interface ServiceCategoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  startingPrice: number;
  activeProsCount: number;
  popularServices: string[];
  gradient: string;
  accentColor: string;
}

export interface VerifiedProItem {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string;
  headline: string;
  category: string;
  experienceYears: number;
  rating: number;
  reviewsCount: number;
  completedJobsCount: number;
  hourlyRate: number;
  fixedRate?: number;
  serviceRadiusKm: number;
  location: string;
  isVerified: boolean;
  skills: string[];
  certificate: string;
}

export interface ReviewItem {
  id: string;
  customerName: string;
  customerAvatar: string;
  serviceTitle: string;
  rating: number;
  comment: string;
  date: string;
  jobCompleted: boolean;
  proName: string;
  proRole: string;
  proReply?: {
    author: string;
    text: string;
    date: string;
  };
}

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatBadgeModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  public notificationService = inject(NotificationService);
  public authService = inject(AuthService);
  private customerServicesService = inject(CustomerServicesService);

  userDashboardRoute = computed(() => {
    const roles = this.authService.userRoles();
    if (roles.some((r) => r.toLowerCase() === 'admin')) return '/admin-dashboard';
    if (roles.some((r) => r.toLowerCase() === 'professional')) return '/professional-dashboard';
    return '/customer-dashboard';
  });

  // Search & Filter State
  searchQuery = signal('');
  selectedCategoryId = signal('all');
  selectedLocation = signal('Bole, Addis Ababa');

  // How it works active tab ('customer' | 'pro')
  howItWorksTab = signal<'customer' | 'pro'>('customer');

  // Active Category Showcase Tab
  activeCategoryShowcase = signal('cleaning');

  // Interactive Estimator State
  estimatorCategory = signal('cleaning');
  estimatorServiceType = signal('deep-cleaning');
  estimatorScope = signal('medium'); // small, medium, large, full
  estimatorUrgency = signal('standard'); // standard, urgent

  // Bookmarked Professionals
  bookmarkedPros = signal<Set<string>>(new Set(['pro-1', 'pro-2']));

  // FAQ Accordion State
  activeFaqIndex = signal<number | null>(0);

  // Mobile menu open
  mobileNavOpen = signal(false);

  // Toast / notification message
  toastMessage = signal<string | null>(null);

  // Locations list for matching radius
  locations = [
    'Bole, Addis Ababa',
    'Kazanchis, Addis Ababa',
    'CMC & Ayat, Addis Ababa',
    'Sarbet & Old Airport, Addis Ababa',
    'Piassa & Arada, Addis Ababa',
    'Gerji & Imperial, Addis Ababa',
    'Megenagna, Addis Ababa'
  ];

  // Service Categories
  categories: ServiceCategoryItem[] = [
    {
      id: 'cleaning',
      name: 'Home Cleaning',
      icon: 'cleaning_services',
      description: 'Standard, deep cleaning, sofa sanitization & window washing by vetted maids.',
      startingPrice: 450,
      activeProsCount: 84,
      popularServices: ['Standard Clean', 'Deep House Clean', 'Sofa & Carpet Wash', 'Post-Construction'],
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      accentColor: '#0284c7'
    },
    {
      id: 'electrical',
      name: 'Electrical & Wiring',
      icon: 'bolt',
      description: 'Certified electricians for fan installations, smart wiring, generators & breakers.',
      startingPrice: 600,
      activeProsCount: 62,
      popularServices: ['Ceiling Fan Setup', 'Breaker Box Repair', 'Smart Home Wiring', 'Lighting Installation'],
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      accentColor: '#d97706'
    },
    {
      id: 'plumbing',
      name: 'Plumbing & Pipes',
      icon: 'plumbing',
      description: 'Rapid leak detection, pipe unclogging, bathroom sanitary fittings & water tanks.',
      startingPrice: 500,
      activeProsCount: 57,
      popularServices: ['Pipe Leak Repair', 'Bathroom Fitting', 'Drain Cleaning', 'Water Pump Repair'],
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      accentColor: '#0891b2'
    },
    {
      id: 'painting',
      name: 'Painting & Walls',
      icon: 'format_paint',
      description: 'Flawless interior & exterior wall painting, waterproof sealants & drywall touch-ups.',
      startingPrice: 850,
      activeProsCount: 41,
      popularServices: ['Interior Room Paint', 'Exterior House Paint', 'Waterproof Coating', 'Wallpaper & Texture'],
      gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      accentColor: '#7c3aed'
    },
    {
      id: 'carpentry',
      name: 'Carpentry & Furniture',
      icon: 'handyman',
      description: 'Custom furniture assembly, cabinet repair, door hinges & lock replacement.',
      startingPrice: 550,
      activeProsCount: 39,
      popularServices: ['Furniture Assembly', 'Door & Lock Fix', 'Kitchen Cabinet Repair', 'Custom Shelving'],
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      accentColor: '#ea580c'
    },
    {
      id: 'appliance',
      name: 'Appliance Repair',
      icon: 'kitchen',
      description: 'Fast diagnostics & repair for refrigerators, washing machines, microwaves & AC units.',
      startingPrice: 650,
      activeProsCount: 48,
      popularServices: ['Refrigerator Fix', 'Washing Machine', 'Microwave & Oven', 'AC & Water Heater'],
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      accentColor: '#059669'
    },
    {
      id: 'gardening',
      name: 'Gardening & Outdoor',
      icon: 'yard',
      description: 'Lawn mowing, hedge trimming, weed removal, soil treatment & landscape design.',
      startingPrice: 400,
      activeProsCount: 31,
      popularServices: ['Lawn Mowing', 'Hedge Trimming', 'Garden Renovation', 'Pest Tree Spray'],
      gradient: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
      accentColor: '#65a30d'
    },
    {
      id: 'security',
      name: 'Home Security',
      icon: 'security',
      description: 'Smart CCTV cameras, motion sensors, intercom setup & electronic door locks.',
      startingPrice: 900,
      activeProsCount: 26,
      popularServices: ['CCTV Camera Setup', 'Smart Video Doorbell', 'Motion Sensor Hub', 'Intercom Wiring'],
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      accentColor: '#4f46e5'
    }
  ];

  // Top Verified Professionals
  verifiedPros: VerifiedProItem[] = [
    {
      id: 'pro-1',
      userId: 'u-101',
      name: 'Dawit Kebede',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      headline: 'Certified Master Electrician & Smart Home Specialist',
      category: 'Electrical & Wiring',
      experienceYears: 8,
      rating: 4.96,
      reviewsCount: 142,
      completedJobsCount: 248,
      hourlyRate: 650,
      fixedRate: 850,
      serviceRadiusKm: 2.5,
      location: 'Bole, Addis Ababa',
      isVerified: true,
      skills: ['Smart Wiring', 'Breakers & Panels', 'Ceiling Fans', 'Inverter Systems'],
      certificate: 'National Electrical Safety Board Cert #ET-9481'
    },
    {
      id: 'pro-2',
      userId: 'u-102',
      name: 'Sara Mengistu',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      headline: 'Deep Cleaning & Sanitization Professional',
      category: 'Home Cleaning',
      experienceYears: 6,
      rating: 5.0,
      reviewsCount: 198,
      completedJobsCount: 312,
      hourlyRate: 450,
      fixedRate: 750,
      serviceRadiusKm: 1.5,
      location: 'CMC / Ayat, Addis Ababa',
      isVerified: true,
      skills: ['Deep Villa Cleaning', 'Steam Sanitization', 'Sofa Upholstery', 'Eco-Products'],
      certificate: 'Pro Hygiene & Bio-Sanitation License #CL-4410'
    },
    {
      id: 'pro-3',
      userId: 'u-103',
      name: 'Abel Tadesse',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      headline: 'Master Plumber • Leak Detection & Tank Specialist',
      category: 'Plumbing & Pipes',
      experienceYears: 9,
      rating: 4.92,
      reviewsCount: 114,
      completedJobsCount: 195,
      hourlyRate: 550,
      fixedRate: 900,
      serviceRadiusKm: 2.0,
      location: 'Kazanchis, Addis Ababa',
      isVerified: true,
      skills: ['Acoustic Leak Detection', 'Bathroom Fitting', 'Water Pump Overhaul', 'Drain Snakes'],
      certificate: 'Certified Hydraulic & Sanitary License #PL-3829'
    },
    {
      id: 'pro-4',
      userId: 'u-104',
      name: 'Meron Girma',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
      headline: 'Architectural & Interior Decorative Painter',
      category: 'Painting & Walls',
      experienceYears: 5,
      rating: 4.88,
      reviewsCount: 86,
      completedJobsCount: 140,
      hourlyRate: 600,
      fixedRate: 1400,
      serviceRadiusKm: 1.8,
      location: 'Sarbet, Addis Ababa',
      isVerified: true,
      skills: ['Texture & Velvet Finish', 'Moisture Sealing', 'Airless Spray', 'Color Matching'],
      certificate: 'Certified Interior Surface Finisher #PT-1092'
    },
    {
      id: 'pro-5',
      userId: 'u-105',
      name: 'Eyob Bekele',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      headline: 'Smart Appliance & HVAC Senior Technician',
      category: 'Appliance Repair',
      experienceYears: 7,
      rating: 4.94,
      reviewsCount: 129,
      completedJobsCount: 210,
      hourlyRate: 700,
      fixedRate: 950,
      serviceRadiusKm: 2.5,
      location: 'Gerji, Addis Ababa',
      isVerified: true,
      skills: ['Compressor Diagnostics', 'Inverter PCB Board', 'Washing Motors', 'Cooling Recharge'],
      certificate: 'Certified Refrigeration & HVAC Tech #AP-7731'
    },
    {
      id: 'pro-6',
      userId: 'u-106',
      name: 'Helen Assefa',
      avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
      headline: 'Garden Landscaper & Green Area Maintenance Artist',
      category: 'Gardening & Outdoor',
      experienceYears: 4,
      rating: 4.91,
      reviewsCount: 65,
      completedJobsCount: 98,
      hourlyRate: 450,
      fixedRate: 800,
      serviceRadiusKm: 1.2,
      location: 'Old Airport, Addis Ababa',
      isVerified: true,
      skills: ['Lawn Irrigation', 'Ornamental Tree Pruning', 'Organic Fertilization', 'Paving'],
      certificate: 'Horticulture & Landscape Guild Cert #GD-5501'
    }
  ];

  // Real Customer Reviews with Bidirectional Pro Replies
  reviews: ReviewItem[] = [
    {
      id: 'rev-1',
      customerName: 'Abebe Haile',
      customerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      serviceTitle: 'Ceiling Fan & Breaker Box Installation',
      rating: 5,
      comment: 'Dawit arrived exactly on time with all diagnostic equipment. Replaced the faulty breaker box and hung two ceiling fans in under 2 hours. Escrow payment gave me total peace of mind!',
      date: 'Yesterday',
      jobCompleted: true,
      proName: 'Dawit Kebede',
      proRole: 'Master Electrician',
      proReply: {
        author: 'Dawit Kebede',
        text: 'Thank you Abebe! Glad the new circuit breaker setup works smoothly. Feel free to contact me whenever you need smart home upgrades.',
        date: '1 day ago'
      }
    },
    {
      id: 'rev-2',
      customerName: 'Rahel Wolde',
      customerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      serviceTitle: 'Full 3-Bedroom Villa Deep Cleaning',
      rating: 5,
      comment: 'Sara and her team left our new house spotless before move-in. The steam cleaning on sofas removed years of dust. Truly 5-star service and totally hassle-free.',
      date: '3 days ago',
      jobCompleted: true,
      proName: 'Sara Mengistu',
      proRole: 'Cleaning Specialist',
      proReply: {
        author: 'Sara Mengistu',
        text: 'It was a pleasure helping you settle into your new home Rahel! Enjoy your pristine space!',
        date: '2 days ago'
      }
    },
    {
      id: 'rev-3',
      customerName: 'Yonas Berhanu',
      customerAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop&q=80',
      serviceTitle: 'Concealed Water Pipe Leak Detection',
      rating: 5,
      comment: 'Abel pinpointed an underground pipe leak behind our kitchen tiles without unnecessary demolition. Saved us thousands in repair costs. Highly recommended professional.',
      date: '5 days ago',
      jobCompleted: true,
      proName: 'Abel Tadesse',
      proRole: 'Master Plumber',
      proReply: {
        author: 'Abel Tadesse',
        text: 'Always happy to prevent structural water damage with acoustic gear! Thanks for trusting Callbet.',
        date: '4 days ago'
      }
    }
  ];

  // FAQs
  faqs: FaqItem[] = [
    {
      question: 'How does Callbet 100% Escrow Protection work?',
      answer: 'When you book a service, your payment is securely held by Callbet in a digital escrow ledger. The funds are NOT released to the worker upfront. Only after the professional completes the job, provides proof photos, and you inspect and approve the work within the 24-hour verification window, will the payout be released to the worker.',
      category: 'Payment & Escrow'
    },
    {
      question: 'How are service professionals verified on Callbet?',
      answer: 'Every professional undergoes our strict 3-stage e-KYC vetting: 1) Government ID and biometric selfie check, 2) Formal trade license & certification verification, and 3) Structured CV/experience vetting by our compliance administration. Unverified workers cannot accept jobs.',
      category: 'Trust & Safety'
    },
    {
      question: 'How does location and radius dispatch work?',
      answer: 'When you request a service in your neighborhood (e.g. Bole, CMC, Kazanchis), Callbet calculates GPS coordinates and matches you with verified professionals whose active service radius covers your location. Your full street address is shielded until a professional formally accepts your job.',
      category: 'Dispatch'
    },
    {
      question: 'What pricing types are supported?',
      answer: 'Callbet supports three transparent billing types: 1) Fixed Rate (e.g. standard flat fee for Sofa Cleaning), 2) Hourly Rate (for open-ended handyman or electrical troubleshooting), and 3) Custom Quote (for large multi-room painting or major renovations where a pro bids based on your specifications).',
      category: 'Pricing'
    },
    {
      question: 'Can I chat with the professional before or during the job?',
      answer: 'Yes! Once your booking is assigned, a secure, private job-scoped chat session opens directly in the Callbet app where you can exchange instructions, share photos of the issue, and track arrival status in real-time.',
      category: 'Communication'
    },
    {
      question: 'How do I join as a service professional and get clients?',
      answer: 'Simply click "Join as a Pro", register your profile, upload your resume, structured skills, certifications, and service radius. Once approved by our team, you will receive real-time job alerts nearby and earn guaranteed payouts.',
      category: 'Professionals'
    }
  ];

  // Dynamic Cost & Duration Estimator Calculations
  estimatorPricing: Record<string, Record<string, { base: number; duration: number; name: string }>> = {
    cleaning: {
      'deep-cleaning': { base: 650, duration: 180, name: 'Deep Villa / Apartment Cleaning' },
      'standard-cleaning': { base: 400, duration: 120, name: 'Standard Regular House Cleaning' },
      'sofa-cleaning': { base: 500, duration: 90, name: 'Sofa & Upholstery Steam Wash' },
      'window-cleaning': { base: 350, duration: 75, name: 'Glass & Window Wash' }
    },
    electrical: {
      'fan-install': { base: 550, duration: 60, name: 'Ceiling Fan & Light Fixture Setup' },
      'wiring-repair': { base: 750, duration: 120, name: 'Circuit Breaker & Short Circuit Fix' },
      'generator-service': { base: 1100, duration: 150, name: 'Generator & Inverter Maintenance' },
      'smart-home': { base: 900, duration: 90, name: 'Smart Switch & Sensor Wiring' }
    },
    plumbing: {
      'leak-repair': { base: 600, duration: 90, name: 'Concealed Pipe & Tap Leak Fix' },
      'drain-unclog': { base: 450, duration: 60, name: 'Sink & Bathroom Drain Unclogging' },
      'tank-install': { base: 1200, duration: 180, name: 'Water Tank & Pump Installation' },
      'toilet-repair': { base: 500, duration: 75, name: 'Sanitary Commode & Flush Valve' }
    },
    painting: {
      'interior-room': { base: 1400, duration: 360, name: '1-Room Interior Wall Painting' },
      'waterproofing': { base: 1800, duration: 300, name: 'Ceiling & Wall Moisture Sealing' },
      'exterior-paint': { base: 2600, duration: 480, name: 'Exterior Facade Painting' },
      'touchup': { base: 600, duration: 120, name: 'Drywall Patching & Touchup' }
    }
  };

  // Computed Estimator Results
  estimatedPrice = computed(() => {
    const cat = this.estimatorCategory();
    const catServices = this.estimatorPricing[cat] || this.estimatorPricing['cleaning'];
    const srvKey = this.estimatorServiceType();
    const srv = catServices[srvKey] || Object.values(catServices)[0] || { base: 500, duration: 90, name: 'Service' };

    let multiplier = 1.0;
    if (this.estimatorScope() === 'small') multiplier = 0.8;
    if (this.estimatorScope() === 'medium') multiplier = 1.0;
    if (this.estimatorScope() === 'large') multiplier = 1.5;
    if (this.estimatorScope() === 'full') multiplier = 2.2;

    const urgencyMult = this.estimatorUrgency() === 'urgent' ? 1.25 : 1.0;
    return Math.round(srv.base * multiplier * urgencyMult);
  });

  estimatedDuration = computed(() => {
    const cat = this.estimatorCategory();
    const catServices = this.estimatorPricing[cat] || this.estimatorPricing['cleaning'];
    const srvKey = this.estimatorServiceType();
    const srv = catServices[srvKey] || Object.values(catServices)[0] || { base: 500, duration: 90, name: 'Service' };

    let multiplier = 1.0;
    if (this.estimatorScope() === 'small') multiplier = 0.8;
    if (this.estimatorScope() === 'medium') multiplier = 1.0;
    if (this.estimatorScope() === 'large') multiplier = 1.4;
    if (this.estimatorScope() === 'full') multiplier = 2.0;

    const mins = Math.round(srv.duration * multiplier);
    if (mins < 60) return `${mins} mins`;
    const hours = (mins / 60).toFixed(1);
    return `${hours} hrs (~${mins} mins)`;
  });

  estimatedWorkerPayout = computed(() => {
    return Math.round(this.estimatedPrice() * 0.85);
  });

  estimatedPlatformFee = computed(() => {
    return Math.round(this.estimatedPrice() * 0.15);
  });

  ngOnInit(): void {
    this.loadDynamicCategories();
  }

  loadDynamicCategories(): void {
    this.customerServicesService.getCategories().subscribe({
      next: (cats: any[]) => {
        if (cats && cats.length > 0) {
          const colors = [
            { gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', accent: '#0284c7' },
            { gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', accent: '#d97706' },
            { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', accent: '#0891b2' },
            { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', accent: '#7c3aed' },
            { gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', accent: '#059669' },
            { gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', accent: '#db2777' }
          ];

          const dynamicMapped: ServiceCategoryItem[] = cats.map((cat, idx) => {
            const color = colors[idx % colors.length];
            return {
              id: cat.id,
              name: cat.name,
              icon: this.getCategoryIcon(cat.name),
              description: cat.description || `Professional ${cat.name} services by verified specialists across Addis Ababa.`,
              startingPrice: 100,
              activeProsCount: 15 + (idx * 7),
              popularServices: [`Standard ${cat.name}`, `Emergency ${cat.name}`, `Custom Installation`],
              gradient: color.gradient,
              accentColor: color.accent
            };
          });

          this.categories = dynamicMapped;
        }
      },
      error: () => {}
    });
  }

  getCategoryIcon(name: string): string {
    if (!name) return 'home_repair_service';
    const n = name.toLowerCase();
    if (n.includes('electric') || n.includes('power') || n.includes('wiring')) return 'bolt';
    if (n.includes('plumb') || n.includes('pipe') || n.includes('water') || n.includes('drain')) return 'plumbing';
    if (n.includes('clean') || n.includes('sanitat') || n.includes('maid')) return 'cleaning_services';
    if (n.includes('hvac') || n.includes('ac') || n.includes('air') || n.includes('cooling')) return 'ac_unit';
    if (n.includes('carpent') || n.includes('wood') || n.includes('furniture')) return 'handyman';
    if (n.includes('paint') || n.includes('wall') || n.includes('finish')) return 'format_paint';
    if (n.includes('garden') || n.includes('landscap') || n.includes('lawn')) return 'yard';
    if (n.includes('roof')) return 'roofing';
    return 'home_repair_service';
  }

  // Handle Search Execution
  executeSearch(): void {
    const query = this.searchQuery().trim();
    const cat = this.selectedCategoryId();
    const loc = this.selectedLocation();

    this.router.navigate(['/customer-services'], {
      queryParams: {
        search: query || undefined,
        categoryId: cat !== 'all' ? cat : undefined,
        location: loc || undefined
      }
    });
  }

  // Category Quick Pill Select
  selectCategoryPill(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.router.navigate(['/customer-services'], {
      queryParams: {
        categoryId: categoryId !== 'all' ? categoryId : undefined
      }
    });
  }

  // Switch category for estimator
  onEstimatorCategoryChange(catKey: string): void {
    this.estimatorCategory.set(catKey);
    const catServices = (this.estimatorPricing as any)[catKey];
    if (catServices) {
      const firstSrvKey = Object.keys(catServices)[0];
      this.estimatorServiceType.set(firstSrvKey);
    }
  }

  // Get service list for selected estimator category
  getEstimatorServicesList(): { key: string; name: string; base: number }[] {
    const cat = this.estimatorCategory();
    const catServices = this.estimatorPricing[cat] || this.estimatorPricing['cleaning'] || {};
    return Object.entries(catServices).map(([key, item]) => ({
      key,
      name: item.name,
      base: item.base
    }));
  }

  // Toggle bookmark for professional
  toggleBookmark(proId: string, proName: string, event: Event): void {
    event.stopPropagation();
    const current = new Set(this.bookmarkedPros());
    if (current.has(proId)) {
      current.delete(proId);
      this.showToast(`Removed ${proName} from saved favorites`);
    } else {
      current.add(proId);
      this.showToast(`❤️ Saved ${proName} to your favorites!`);
    }
    this.bookmarkedPros.set(current);
  }

  isBookmarked(proId: string): boolean {
    return this.bookmarkedPros().has(proId);
  }

  // Toggle FAQ Accordion
  toggleFaq(index: number): void {
    if (this.activeFaqIndex() === index) {
      this.activeFaqIndex.set(null);
    } else {
      this.activeFaqIndex.set(index);
    }
  }

  // Quick book service from category card
  bookCategory(category: ServiceCategoryItem): void {
    this.router.navigate(['/customer-services'], {
      queryParams: {
        categoryId: category.id,
        categoryName: category.name
      }
    });
  }

  // Book with pro
  bookPro(pro: VerifiedProItem): void {
    this.router.navigate(['/customer-services'], {
      queryParams: {
        search: pro.name,
        isVerified: 'true'
      }
    });
  }

  // Show temporary toast feedback
  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}
