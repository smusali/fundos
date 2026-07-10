import { MongoClient, type Db } from 'mongodb';
import { loadConfig } from '../config';

let client: MongoClient | undefined;

/** Lazily connects one shared client; callers get the fundos database. */
export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(loadConfig().MONGODB_URI, {
      serverSelectionTimeoutMS: 2_000,
    });
    await client.connect();
  }
  return client.db();
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
  }
}
