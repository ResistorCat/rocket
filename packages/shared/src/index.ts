export type HealthCheck = {
  status: 'ok' | 'error';
  timestamp: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type Category = {
  id: number;
  name: string;
  icon: string | null;
  deletedAt: string | null;
};

export type CreateCategory = {
  name: string;
  icon?: string;
};
