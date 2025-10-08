import { PropertyData } from "./PropertyData";

export interface PropertyDataList {
  items: PropertyData[];
  total?: number;
  page?: number;
}
