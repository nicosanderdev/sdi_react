import { PlanKey } from "./PlanKey";
import type { PropertyType } from "../properties/PropertyData";

export interface PlanData {
    id: string;
    key: PlanKey;
    name: string;
    monthlyPrice: number;
    currency: string;
    maxProperties: number; // Deprecated: Use totalProperties instead
    maxUsers: number;
    maxStorageMb: number;
    billingCycle: string;
    isActive: boolean;
    publishedProperties: number; // MaxPublishedProperties from database
    totalProperties: number; // MaxProperties from database
    /** Minimum unpaid commission sum to create a receipt (Free tier). Set per plan in env. */
    bookingReceiptMinimumAmount?: number | null;
    /** Estate property type this plan applies to (RealEstate, AnnualRent, EventVenue, SummerRent). */
    propertyType?: PropertyType;
}