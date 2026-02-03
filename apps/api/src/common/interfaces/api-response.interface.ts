export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  metadata: Record<string, unknown> | null;
}
