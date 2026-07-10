import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface ObjectStorage {
  put(key: string, bytes: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
}

/**
 * Local data directories anchor at the repo root (marked by compose.yaml) so
 * the dev server, tests, and scripts all read and write the same place
 * regardless of their working directory.
 */
export function dataRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'compose.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

/**
 * Filesystem-backed object storage for local runs; the deploy target swaps in
 * an S3 implementation behind the same interface.
 */
export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string = resolve(dataRoot(), '.uploads')) {}

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
