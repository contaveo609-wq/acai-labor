import type { LaborDatabase } from "./labor.types";
export type LaborDependencies = {
  directory: string;
  storeId: string;
  read: () => Promise<LaborDatabase>;
  mutate: <T>(fn: (db: LaborDatabase) => T | Promise<T>) => Promise<T>;
  requireAdmin: (token?: string) => void;
  requireSensitive: (token?: string) => void;
  audit: (db: LaborDatabase, action: string, id: string, detail: string, actor?: string) => void;
};
