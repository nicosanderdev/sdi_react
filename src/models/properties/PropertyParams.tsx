export interface PropertyParams {
  pageNumber?: number,
  pageSize?: number,
  filter: {
    isDeleted?: boolean,
    ownerId?: string,
    createdAfter?: Date,
    createdBefore?: Date,
    status?: string,
    searchTerm?: string
  }
}
