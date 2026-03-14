export interface BillingHistoryData {
    id: string;
    subscriptionId: string;
    providerInvoiceId: string;
    amount: number;
    currency: string;
    status: string;
    paidAt: Date;
    createdAt: Date;
}

export interface BillingHistoryList {
    items: BillingHistoryData[];
    total?: number;
    page?: number;
  }