export type StorageBucketName =
  | 'property_images'
  | 'property_documents'
  | 'avatars'

export interface StorageService {
  presignAndUpload(
    file: File,
    params: { bucket: StorageBucketName; key: string },
  ): Promise<{ publicUrl: string; key: string }>

  deleteObject(params: { bucket: StorageBucketName; key: string }): Promise<void>
}
