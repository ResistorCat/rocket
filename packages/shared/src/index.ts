export type HealthCheck = {
  status: 'ok' | 'error';
  timestamp: string;
  provider?: string;
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

export type Transaction = {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  accountId: number;
  categoryId: number | null;
  description: string | null;
  date: string;
  createdAt: string;
};

export type CreateTransaction = {
  amount: number;
  type: 'income' | 'expense';
  accountId: number;
  categoryId?: number | null;
  description?: string | null;
  date: string;
};

export type UpdateTransaction = Partial<CreateTransaction>;

export type CategorySummary = {
  categoryId: number | null;
  amount: number;
};

export type FinanceSummary = {
  totalIncome: number;
  totalExpense: number;
  incomeByCategory: CategorySummary[];
  expenseByCategory: CategorySummary[];
};

export type CategoryBudget = {
  categoryId: number;
  budgeted: number;
  spent: number;
  remaining: number;
};

export type FinanceBudget = {
  year: number;
  month: number;
  categories: CategoryBudget[];
};

/** Represents a pending tool call waiting for user confirmation */
export type ToolCall = {
  id: string;
  name: string;
  params: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'rejected';
};

/** Payload to confirm or reject a tool call */
export type ToolActionPayload = {
  toolCallId: string;
};

/** Result of a tool execution */
export type ToolResult = {
  toolCallId: string;
  success: boolean;
  message: string;
  data?: any;
};
