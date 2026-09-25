export type JobStage = 1 | 2 | 3 | 4 | 5;

export interface WorkflowJobData {
  jobId?: string;
  serviceId?: string;
  serviceName: string;
  categoryName?: string;
  price: number;
  pricingType?: string;
  professionalProfileId?: string;
  professionalName?: string;
  professionalAvatar?: string;
  professionalHeadline?: string;
  professionalRating?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  address?: string;
  description?: string;
  status?: string;
  timerSeconds?: number;
  rating?: number;
  reviewComment?: string;
}
