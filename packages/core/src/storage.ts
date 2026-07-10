import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface ObjectStorage {
  put(key: string, bytes: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
}

/**
 * Filesystem-backed object storage for local runs; the deploy target swaps in
 * an S3 implementation behind the same interface.
 */
export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string = resolve('.uploads')) {}

  private pathFor(key: string): string {
    const path = resolve(join(this.rootDir, key));
    if (!path.startsWith(this.rootDir)) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return path;
  }

  async put(key: string, bytes: Buffer): Promise<string> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }
}

let storage: ObjectStorage | undefined;

export function getStorage(): ObjectStorage {
  if (!storage) storage = new LocalObjectStorage();
  return storage;
}
