import { MongoClient, MongoServerError, type Db, type IndexSpecification, type CreateIndexesOptions } from 'mongodb';
import { loadConfig } from '../config';

let client: MongoClient | undefined;
let indexesEnsured: Promise<void> | undefined;

/** Parallel processes may build the same index at once; that race is benign. */
async function createIndexSafely(
  db: Db,
  collection: string,
  spec: IndexSpecification,
  options: CreateIndexesOptions = {},
): Promise<void> {
  try {
    await db.collection(collection).createIndex(spec, options);
  } catch (error) {
    if (error instanceof MongoServerError && error.codeName === 'IndexBuildAlreadyInProgress') return;
    throw error;
  }
}

/** Uniqueness the services rely on, enforced at the store against races. */
async function ensureIndexes(db: Db): Promise<void> {
  await createIndexSafely(db, 'users', { email: 1 }, { unique: true });
  await createIndexSafely(db, 'workspaces', { intakeSlug: 1 }, { unique: true });
  await createIndexSafely(db, 'theses', { workspaceId: 1, version: 1 }, { unique: true });
  await createIndexSafely(db, 'evidence', { dealId: 1 });
  await createIndexSafely(db, 'approvals', { workspaceId: 1, status: 1 });
}

/** Lazily connects one shared client; callers get the fundos database. */
export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(loadConfig().MONGODB_URI, {
      serverSelectionTimeoutMS: 2_000,
    });
    await client.connect();
  }
  const db = client.db();
  indexesEnsured ??= ensureIndexes(db);
  await indexesEnsured;
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
  }
}
