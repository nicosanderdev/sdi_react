import { PlanData } from "./PlanData";

export interface SubscriptionData {
    Id: string;
    OwnerType: string;
    OwnerId: string;
    ProviderCustomerId: string;
    ProviderSubscriptionId: string;
    PlanId: string;
    Plan: PlanData;
    Status: string;
    CurrentPeriodStart: Date;
    CurrentPeriodEnd: Date;
    CancelAtPeriodEnd: boolean;
    CreatedAt: Date;
    UpdatedAt: Date;
}