/**
 * Abstracción mínima sobre el driver SQLite concreto (expo-sqlite,
 * react-native-sqlite-storage, op-sqlite, better-sqlite3 en tests, etc.).
 * Los repositorios de infraestructura dependen SOLO de esta interfaz, nunca
 * del driver — permite cambiar de librería nativa sin tocar los repos.
 */
export interface SQLiteRow {
  readonly [column: string]: unknown;
}

export interface SQLiteExecResult {
  readonly rowsAffected: number;
  readonly insertId?: number;
}

export interface SQLiteExecutor {
  execute(sql: string, params?: readonly unknown[]): Promise<SQLiteExecResult>;
  queryAll<T = SQLiteRow>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  queryOne<T = SQLiteRow>(sql: string, params?: readonly unknown[]): Promise<T | null>;
}

/**
 * Fábrica de transacciones nativas. Separada de `SQLiteExecutor` porque solo
 * la conexión raíz (no una transacción en curso) puede abrir una nueva.
 */
export interface SQLiteDatabase extends SQLiteExecutor {
  transaction<T>(work: (tx: SQLiteExecutor) => Promise<T>): Promise<T>;
}
