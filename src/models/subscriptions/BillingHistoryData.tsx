export interface BillingHistoryData {
    Id: string;
    SubscriptionId: string;
    ProviderInvoiceId: string;
    Amount: number;
    Currency: string;
    Status: string;
    PaidAt: Date;
    Created: Date;
}