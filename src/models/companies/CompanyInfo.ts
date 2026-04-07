export interface CompanyInfo {
  id: string;
  name: string;
  billingEmail?: string;
  phone?: string;
  description?: string;
  createdAt: string;
  logoUrl?: string;
  bannerUrl?: string;
  address?: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  subscription?: {
    planName: string;
    endDate: string;
  };
  statistics?: {
    totalProperties: number;
    unansweredMessages: number;
    totalVisits: number;
  };
}

