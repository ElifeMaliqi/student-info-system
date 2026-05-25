export interface DbQueryRequest {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  filters?: { op: string; column: string; value: unknown }[];
  or?: string;
  order?: { column: string; ascending?: boolean }[];
  range?: [number, number];
  limit?: number;
  head?: boolean;
  count?: 'exact' | null;
  single?: boolean;
  maybeSingle?: boolean;
  body?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
}
