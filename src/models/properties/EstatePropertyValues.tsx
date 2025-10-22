export interface EstatePropertyValues {
  id: string;
  description?: string;
  availableFrom: Date;
  capacity: number;
  
  // Price and status
  currency: number; // Currency enum value
  salePrice?: number;
  rentPrice?: number;
  hasCommonExpenses: boolean;
  commonExpensesValue?: number;
  isElectricityIncluded?: boolean;
  isWaterIncluded?: boolean;
  isPriceVisible: boolean;
  status: number; // PropertyStatus enum value
  isActive: boolean;
  isPropertyVisible: boolean;
  
  // Relationships
  isFeatured: boolean;
  estatePropertyId: string;
  
  // BaseAuditableEntity fields
  createdAt: Date;
  createdBy?: string;
  lastModified?: Date;
  lastModifiedBy?: string;
}
