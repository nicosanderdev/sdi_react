export interface PropertyDocument {
  id?: string;
  url: string;
  name: string;
  estatePropertyId: string;
  fileName: string;
  file?: File;
  isPublic: boolean;
}
