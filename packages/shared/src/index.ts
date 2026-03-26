export interface HealthResponse {
  status: "ok" | "error";
  message: string;
}

export interface ApiResponse<T = unknown> {
  data: T;
  error?: string;
}
