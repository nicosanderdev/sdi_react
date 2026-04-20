# Creates buckets and anonymous read on a local MinIO (Docker on host :9000).
# Community MinIO does not support per-bucket CORS via `mc cors set`; use
# MINIO_API_CORS_ALLOW_ORIGIN on the MinIO server (see README).
param(
  [string]$Endpoint = "http://host.docker.internal:9000",
  [string]$AccessKey = "admin",
  [string]$SecretKey = "password"
)

$ErrorActionPreference = "Stop"

$cmd = "mc alias set local $Endpoint $AccessKey $SecretKey && " +
  "mc mb --ignore-existing local/property-images && " +
  "mc mb --ignore-existing local/property-documents && " +
  "mc mb --ignore-existing local/avatars && " +
  "mc anonymous set download local/property-images && " +
  "mc anonymous set download local/property-documents && " +
  "mc anonymous set download local/avatars && " +
  "echo MinIO buckets and anonymous download policy are ready."

docker run --rm --entrypoint /bin/sh minio/mc -c $cmd
