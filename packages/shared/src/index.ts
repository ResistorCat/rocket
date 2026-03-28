export type HealthCheck = {
  status: 'ok' | 'error';
  timestamp: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
