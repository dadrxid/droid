import {promises as fs, createWriteStream} from 'fs';
import path from 'path';
import {inject, injectable} from 'inversify';
import {TYPES} from '../types.js';
import Config from './config.js';
import PQueue from 'p-queue';
import debug from '../utils/debug.js';
import {prisma} from '../utils/db.js';
import {FileCache} from '@prisma/client';

@injectable()
export default class FileCacheProvider {
  private static readonly evictionQueue = new PQueue({concurrency: 1});
  private static readonly inUseHashes = new Set<string>();
  private static readonly activeWrites = new Set<string>();
  private readonly config: Config;

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config;
  }

  markInUse(hash: string): void {
    FileCacheProvider.inUseHashes.add(hash);
  }

  releaseInUse(hash: string): void {
    FileCacheProvider.inUseHashes.delete(hash);
  }

  isWriteInProgress(hash: string): boolean {
    return FileCacheProvider.activeWrites.has(hash);
  }

  /**
   * Returns path to cached file if it exists, otherwise returns null.
   * Updates the `accessedAt` property of the cached file.
   * @param hash lookup key
   */
  async getPathFor(hash: string): Promise<string | null> {
    const model = await prisma.fileCache.findUnique({
      where: {
        hash,
      },
    });

    if (!model) {
      return null;
    }

    const resolvedPath = path.join(this.config.CACHE_DIR, hash);

    try {
      await fs.access(resolvedPath);
    } catch (_: unknown) {
      await prisma.fileCache.delete({
        where: {
          hash,
        },
      });

      return null;
    }

    await prisma.fileCache.update({
      where: {
        hash,
      },
      data: {
        accessedAt: new Date(),
      },
    });

    return resolvedPath;
  }

  /**
   * Returns a write stream for the given hash key.
   * The stream handles saving a new file and will
   * update the database after the stream is closed.
   * @param hash lookup key
   */
  createWriteStream(hash: string) {
    const tmpPath = path.join(this.config.CACHE_DIR, 'tmp', hash);
    const finalPath = path.join(this.config.CACHE_DIR, hash);

    FileCacheProvider.activeWrites.add(hash);

    const stream = createWriteStream(tmpPath);

    stream.on('close', async () => {
      try {
        const stats = await fs.stat(tmpPath);

        if (stats.size !== 0) {
          await fs.rename(tmpPath, finalPath);

          await prisma.fileCache.upsert({
            where: {hash},
            update: {
              accessedAt: new Date(),
              bytes: stats.size,
            },
            create: {
              hash,
              accessedAt: new Date(),
              bytes: stats.size,
            },
          });
        }

        await this.evictOldestIfNecessary();
      } catch (error: unknown) {
        debug(`Failed to finalize cache write for ${hash}:`, error);
        try {
          await fs.unlink(tmpPath);
        } catch {
          // ignore cleanup errors
        }
      } finally {
        FileCacheProvider.activeWrites.delete(hash);
      }
    });

    return stream;
  }

  /**
   * Deletes orphaned cache files and evicts files if
   * necessary. Should be run on program startup so files
   * will be evicted if the cache limit has changed.
   */
  async cleanup() {
    await this.removeOrphans();
    await this.evictOldestIfNecessary();
  }

  private async evictOldestIfNecessary() {
    void FileCacheProvider.evictionQueue.add(this.evictOldest.bind(this));

    return FileCacheProvider.evictionQueue.onEmpty();
  }

  private async evictOldest() {
    debug('Evicting oldest files...');

    let totalSizeBytes = await this.getDiskUsageInBytes();
    let numOfEvictedFiles = 0;
    // Continue to evict until we're under the limit
    /* eslint-disable no-await-in-loop */
    while (totalSizeBytes > this.config.CACHE_LIMIT_IN_BYTES) {
      const inUse = [...FileCacheProvider.inUseHashes];

      const oldest = await prisma.fileCache.findFirst({
        where: inUse.length > 0 ? {hash: {notIn: inUse}} : undefined,
        orderBy: {
          accessedAt: 'asc',
        },

      });

      if (!oldest) {
        break;
      }

      await prisma.fileCache.delete({
        where: {
          hash: oldest.hash,
        },
      });
      await fs.unlink(path.join(this.config.CACHE_DIR, oldest.hash));
      debug(`${oldest.hash} has been evicted`);
      numOfEvictedFiles++;

      totalSizeBytes = await this.getDiskUsageInBytes();
    }
    /* eslint-enable no-await-in-loop */

    if (numOfEvictedFiles > 0) {
      debug(`${numOfEvictedFiles} files have been evicted`);
    } else {
      debug(`No files needed to be evicted. Total size of the cache is currently ${totalSizeBytes} bytes, and the cache limit is ${this.config.CACHE_LIMIT_IN_BYTES} bytes.`);
    }
  }

  private async removeOrphans() {
    // Check filesystem direction (do files exist on the disk but not in the database?)
    for await (const dirent of await fs.opendir(this.config.CACHE_DIR)) {
      if (dirent.isFile()) {
        const model = await prisma.fileCache.findUnique({
          where: {
            hash: dirent.name,
          },
        });

        if (!model) {
          debug(`${dirent.name} was present on disk but was not in the database. Removing from disk.`);
          await fs.unlink(path.join(this.config.CACHE_DIR, dirent.name));
        }
      }
    }

    // Check database direction (do entries exist in the database but not on the disk?)
    for await (const model of this.getFindAllIterable()) {
      const filePath = path.join(this.config.CACHE_DIR, model.hash);

      try {
        await fs.access(filePath);
      } catch {
        debug(`${model.hash} was present in database but was not on disk. Removing from database.`);
        await prisma.fileCache.delete({
          where: {
            hash: model.hash,
          },
        });
      }
    }
  }

  /**
   * Pulls from the database rather than the filesystem,
   * so may be slightly inaccurate.
   * @returns the total size of the cache in bytes
   */
  private async getDiskUsageInBytes() {
    const data = await prisma.fileCache.aggregate({
      _sum: {
        bytes: true,
      },
    });
    const totalSizeBytes = data._sum.bytes ?? 0;

    return totalSizeBytes;
  }

  /**
   * An efficient way to iterate over all rows.
   * @returns an iterable for the result of FileCache.findAll()
   */
  private getFindAllIterable() {
    const limit = 50;
    let previousCursor: {createdAt: Date; hash: string} | null = null;

    let models: FileCache[] = [];

    const fetchNextBatch = async () => {
      let where;

      if (previousCursor) {
        where = {
          OR: [
            {createdAt: {gt: previousCursor.createdAt}},
            {createdAt: previousCursor.createdAt, hash: {gt: previousCursor.hash}},
          ],
        };
      }

      models = await prisma.fileCache.findMany({
        where,
        orderBy: [
          {createdAt: 'asc'},
          {hash: 'asc'},
        ],
        take: limit,
      });

      if (models.length > 0) {
        const last = models[models.length - 1];
        previousCursor = {createdAt: last.createdAt, hash: last.hash};
      }
    };

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (models.length === 0) {
              await fetchNextBatch();
            }

            if (models.length === 0) {
              // Must return value here for types to be inferred correctly
              return {done: true, value: null as unknown as FileCache};
            }

            return {value: models.shift()!, done: false};
          },
        };
      },
    };
  }
}
