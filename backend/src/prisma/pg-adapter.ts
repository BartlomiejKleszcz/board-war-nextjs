import { Pool, PoolClient } from 'pg';

type SqlQuery = {
  sql: string;
  args: Array<unknown>;
  argTypes: Array<unknown>;
};

type SqlResultSet = {
  columnTypes: Array<number>;
  columnNames: Array<string>;
  rows: Array<Array<unknown>>;
  lastInsertId?: string;
};

type TransactionOptions = {
  usePhantomQuery: boolean;
};

type Transaction = {
  provider: 'postgres';
  adapterName: string;
  options: TransactionOptions;
  queryRaw(params: SqlQuery): Promise<SqlResultSet>;
  executeRaw(params: SqlQuery): Promise<number>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

type SqlDriverAdapter = {
  provider: 'postgres';
  adapterName: string;
  queryRaw(params: SqlQuery): Promise<SqlResultSet>;
  executeRaw(params: SqlQuery): Promise<number>;
  executeScript(script: string): Promise<void>;
  startTransaction(isolationLevel?: unknown): Promise<Transaction>;
  dispose(): Promise<void>;
};

export type SqlDriverAdapterFactory = {
  provider: 'postgres';
  adapterName: string;
  connect(): Promise<SqlDriverAdapter>;
};

const TEXT_COLUMN_TYPE = 7; // ColumnTypeEnum.Text in Prisma typings

function mapResult(result: { rows: Array<any>; fields: Array<{ name: string }>; rowCount?: number }): SqlResultSet {
  const columnNames = result.fields.map((field) => field.name);
  const columnTypes = result.fields.map(() => TEXT_COLUMN_TYPE);
  const rows = result.rows.map((row) => columnNames.map((name) => row[name]));
  return {
    columnTypes,
    columnNames,
    rows,
  };
}

class PgTransaction implements Transaction {
  readonly provider = 'postgres' as const;
  readonly adapterName = 'custom-pg';
  readonly options: TransactionOptions = { usePhantomQuery: false };

  constructor(private readonly client: PoolClient) {}

  async queryRaw(params: SqlQuery): Promise<SqlResultSet> {
    const res = await this.client.query(params.sql, params.args);
    return mapResult(res);
  }

  async executeRaw(params: SqlQuery): Promise<number> {
    const res = await this.client.query(params.sql, params.args);
    return res.rowCount ?? 0;
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
    this.client.release();
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
    this.client.release();
  }
}

class PgAdapter implements SqlDriverAdapter {
  readonly provider = 'postgres' as const;
  readonly adapterName = 'custom-pg';

  constructor(private readonly pool: Pool) {}

  async queryRaw(params: SqlQuery): Promise<SqlResultSet> {
    const res = await this.pool.query(params.sql, params.args);
    return mapResult(res);
  }

  async executeRaw(params: SqlQuery): Promise<number> {
    const res = await this.pool.query(params.sql, params.args);
    return res.rowCount ?? 0;
  }

  async executeScript(script: string): Promise<void> {
    await this.pool.query(script);
  }

  async startTransaction(): Promise<Transaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return new PgTransaction(client);
  }

  async dispose(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgAdapterFactory(databaseUrl?: string): SqlDriverAdapterFactory {
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return {
    provider: 'postgres',
    adapterName: 'custom-pg',
    async connect(): Promise<SqlDriverAdapter> {
      return new PgAdapter(pool);
    },
  };
}
