import { PublicProperty } from "./PublicProperty";

export interface PublicPropertyDataList {
  items: PublicProperty[];
  total?: number;
  page?: number;
}
