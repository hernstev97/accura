import postgres from 'postgres';

const databases = new Map<string, postgres.Sql>();

/** Returns one lazy PostgreSQL pool per connection URL in the current function instance. */
export function getDatabase(databaseUrl: string): postgres.Sql {
  const existing = databases.get(databaseUrl);
  if (existing) return existing;

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  databases.set(databaseUrl, sql);
  return sql;
}
