export interface UpdateCompanyProfilePayload {
  name?: string;
  description?: string;
  address?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

