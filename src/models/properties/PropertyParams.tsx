export interface PropertyParams {
  pageNumber?: number,
  pageSize?: number,
  filter: {
    isDeleted?: boolean,
    ownerId?: string,
    createdAfter?: Date,
    createdBefore?: Date,
    status?: string,
    searchTerm?: string,
    // Bounding box for map viewport filtering
    swLat?: number,  // Southwest latitude
    swLng?: number,  // Southwest longitude
    neLat?: number,  // Northeast latitude
    neLng?: number,  // Northeast longitude
  }
}
