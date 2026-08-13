import { PlanKey } from "./PlanKey";
import type { PropertyType } from "../properties/PropertyData";

export interface PlanData {
    id: string;
    key: PlanKey;
    name: string;
    monthlyPrice: number;
    currency: string;
    /** @deprecated Use totalProperties instead. Null = unlimited. */
    maxProperties: number | null;
    /** Null = unlimited seats. */
    maxUsers: number | null;
    maxStorageMb: number | null;
    billingCycle: string;
    isActive: boolean;
    /** MaxPublishedProperties from database. Null = unlimited. */
    publishedProperties: number | null;
    /** MaxProperties from database. Null = unlimited. */
    totalProperties: number | null;
    /** Minimum unpaid commission sum to create a receipt (Free tier). Set per plan in env. */
    bookingReceiptMinimumAmount?: number | null;
    /** Estate property type this plan applies to (RealEstate, AnnualRent, EventVenue, SummerRent). */
    propertyType?: PropertyType;
    /** Optional lower photo cap; null means use global hard max of 30. */
    maxPhotosPerProperty?: number | null;
}

/** Format a plan limit for display. Null means unlimited. */
export function formatPlanLimit(limit: number | null | undefined): string {
    if (limit == null) return 'Ilimitado';
    return String(limit);
}
