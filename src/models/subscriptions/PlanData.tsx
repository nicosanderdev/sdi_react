import { PlanKey } from "./PlanKey";

export interface PlanData {
    id: string;
    key: PlanKey;
    name: string;
    monthlyPrice: number;
    currency: string;
    maxProperties: number;
    maxUsers: number;
    maxStorageMb: number;
    billingCycle: string;
    isActive: boolean;
}