import { PlanData } from "./PlanData";
import type { PropertyType } from "../properties/PropertyData";

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
    /** Primary estate property type covered by this subscription's plan. */
    propertyType?: PropertyType;
    /** Future-friendly: if a subscription ever covers multiple property types. */
    propertyTypes?: PropertyType[];
}