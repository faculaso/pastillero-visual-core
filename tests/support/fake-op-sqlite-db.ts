import type { DB, QueryResult, Scalar, Transaction } from '@op-engineering/op-sqlite';

/**
 * Fake in-memory que implementa el contrato REAL de `DB`/`Transaction`
 * (mismos `.d.ts` que el paquete instalado), incluida la restricción de que
 * `transaction(fn)` exige `fn: (tx) => Promise<void>` y hace auto-rollback
 * ante throw. Sirve para testear `OpSqliteAdapter` en Node/CI sin bindings
 * nativos (op-sqlite requiere iOS/Android/macOS reales para su versión
 * completa) — replica solo la semántica que `OpSqliteAdapter` consume.
 *
 * No es un motor SQL real: guarda filas en memoria por tabla y resuelve un
 * subconjunto mínimo de SQL (INSERT/SELECT/UPDATE simples) suficiente para
 * probar el bridging de tipos y el manejo de errores del adapter — la
 * corrección del SQL en sí ya está cubierta por los tests de integración
 * reales contra `better-sqlite3`.
 */
export class FakeOpSqliteDb implements Pick<DB, 'execute' | 'transaction' | 'close'> {
  private readonly rows = new Map<string, Record<string, Scalar>[]>();
  private inTransaction = false;

  async execute(query: string, params: Scalar[] = []): Promise<QueryResult> {
    return this.run(query, params);
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    const snapshot = structuredClone([...this.rows.entries()]);
    this.inTransaction = true;
    const tx: Transaction = {
      execute: async (query: string, params: Scalar[] = []) => this.run(query, params),
      commit: async () => ({ rowsAffected: 0, rows: [] }),
      rollback: () => {
        this.restoreSnapshot(snapshot);
        return { rowsAffected: 0, rows: [] };
      },
    };
    try {
      await fn(tx);
    } catch (error) {
      // Replica el comportamiento documentado: error no atrapado -> ROLLBACK.
      this.restoreSnapshot(snapshot);
      this.inTransaction = false;
      throw error;
    }
    this.inTransaction = false;
  }

  private restoreSnapshot(snapshot: readonly (readonly [string, Record<string, Scalar>[]])[]): void {
    this.rows.clear();
    for (const [k, v] of snapshot) this.rows.set(k, v);
  }

  close(): void {
    this.rows.clear();
  }

  /** Helper de test: sembrar filas directamente sin pasar por SQL. */
  seed(table: string, rows: Record<string, Scalar>[]): void {
    this.rows.set(table, [...rows]);
  }

  getTable(table: string): readonly Record<string, Scalar>[] {
    return this.rows.get(table) ?? [];
  }

  private run(query: string, params: Scalar[]): QueryResult {
    const sql = query.trim();
    const insertMatch = sql.match(/^INSERT INTO (\w+)/i);
    const selectMatch = sql.match(/^SELECT \* FROM (\w+)/i);
    const updateMatch = sql.match(/^UPDATE (\w+) SET value = \? WHERE id = \?/i);

    if (insertMatch) {
      const table = insertMatch[1]!;
      const existing = this.rows.get(table) ?? [];
      existing.push({ id: params[0]!, value: params[1] ?? null });
      this.rows.set(table, existing);
      return { rowsAffected: 1, rows: [] };
    }

    if (selectMatch) {
      const table = selectMatch[1]!;
      return { rowsAffected: 0, rows: this.rows.get(table) ?? [] };
    }

    if (updateMatch) {
      const table = updateMatch[1]!;
      const existing = this.rows.get(table) ?? [];
      const row = existing.find((r) => r.id === params[1]);
      if (!row) return { rowsAffected: 0, rows: [] };
      row.value = params[0] ?? null;
      return { rowsAffected: 1, rows: [] };
    }

    // Multi-statement o SQL no reconocido por el fake: no-op controlado
    // (usado por los tests que solo validan el splitting, no el contenido).
    return { rowsAffected: 0, rows: [] };
  }
}
