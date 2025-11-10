import { PlanKey } from "./PlanKey";

export interface PlanData {
    Id: string;
    Key: PlanKey;
    Name: string;
    MonthlyPrice: number;
    Currency: string;
    MaxProperties: number;
    MaxUsers: number;
    MaxStorageMb: number;
    BillingCycle: string;
    IsActive: boolean;
}