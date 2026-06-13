import {injectable} from 'inversify';
import {prisma} from '../utils/db.js';
import debug from '../utils/debug.js';

type Seconds = number;

type Options = {
  expiresIn: Seconds;
  key?: string;
};

const futureTimeToDate = (time: Seconds) => new Date(new Date().getTime() + (time * 1000));

@injectable()
export default class KeyValueCacheProvider {
  async wrap<T extends [...any[], Options], F>(func: (...options: any) => Promise<F>, ...options: T): Promise<F> {
    if (options.length === 0) {
      throw new Error('Missing cache options');
    }

    const functionArgs = options.slice(0, options.length - 1);

    const {
      key: rawKey = JSON.stringify(functionArgs),
      expiresIn,
    } = options[options.length - 1] as Options;

    const key = rawKey.length < 4 ? `kv:${rawKey}` : rawKey;

    const cachedResult = await prisma.keyValueCache.findUnique({
      where: {
        key,
      },
    });

    if (cachedResult) {
      if (new Date() < cachedResult.expiresAt) {
        try {
          debug(`Cache hit: ${key}`);
          return JSON.parse(cachedResult.value) as F;
        } catch {
          await prisma.keyValueCache.delete({where: {key}});
        }
      } else {
        await prisma.keyValueCache.delete({
          where: {
            key,
          },
        });
      }
    }

    debug(`Cache miss: ${key}`);

    const result = await func(...functionArgs);

    if (result === undefined) {
      return result;
    }

    // Save result
    const value = JSON.stringify(result);
    const expiresAt = futureTimeToDate(expiresIn);
    await prisma.keyValueCache.upsert({
      where: {
        key,
      },
      update: {
        value,
        expiresAt,
      },
      create: {
        key,
        value,
        expiresAt,
      },
    });

    return result;
  }
}
