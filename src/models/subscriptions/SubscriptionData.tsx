import { PlanData } from "./PlanData";

export interface SubscriptionData {
    id: string;
    ownerType: string;
    ownerId: string;
    providerCustomerId: string;
    providerSubscriptionId: string;
    planId: string;
    plan: PlanData;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}