export interface PropertyParams {
  ids?: string[],
  pageNumber?: number,
  pageSize?: number,
  filter?: {
    isDeleted?: boolean,
    ownerId?: string,
    createdAfter?: Date,
    createdBefore?: Date,
    status?: string,
    searchTerm?: string,
    includeImages?: boolean,
    includeDocuments?: boolean,
    includeVideos?: boolean,
    includeAmenities?: boolean
  }
}
