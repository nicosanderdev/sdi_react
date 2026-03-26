export interface SdiApiResponse<T = unknown> {
  succeeded: boolean;
  data?: T;
  errorMessage?: string;
}