export interface PropertyImage {
  id?: string;
  contentType?: string;
  url: string;
  altText?: string;
  isMain?: boolean;
  estatePropertyId?: string;
  isPublic?: boolean;
  fileName?: string;
  file?: File;
}