/** Data cache keys are private, versioned and never served as public routes. */
export function channelCacheKey(channel: string, options: { before?: string; after?: string } = {}, version = "v2"): string {
    if (!/^\w+$/.test(channel) || (options.before && options.after)) throw new Error("Invalid Telegram channel or cursor");
    const url = new URL(`https://spacerad.io/__channel-data/${version}/${channel.toLowerCase()}`);
    for (const direction of ["before", "after"] as const) {
        const cursor = options[direction];
        if (cursor !== undefined) {
            if (!/^[1-9]\d*$/.test(cursor)) throw new Error("Invalid Telegram cursor");
            url.searchParams.set(direction, cursor);
        }
    }
    return url.href;
}

export interface ChannelCacheStore {
    match(key: string): Promise<Response | undefined>;
    put(key: string, response: Response): Promise<unknown>;
}
interface Snapshot<T> {
    data?: T;
    fetchedAt?: number;
    retryAfter: number;
}
interface CacheOptions<T> {
    load: (key: string, signal: AbortSignal) => Promise<T>;
    cache: () => ChannelCacheStore | undefined;
    now?: () => number;
    timeoutMs?: number;
    maxEntries?: number;
}
const MAX_STALE_MS = 3_600_000;
const RETRY_MS = 30_000;

/** Cache API is shared per data center; memory and pending promises are only per isolate. */
export function createChannelDataCache<T>({ load, cache, now = Date.now, timeoutMs = 2000, maxEntries = 128 }: CacheOptions<T>) {
    const memory = new Map<string, Snapshot<T>>();
    const pending = new Map<string, Promise<T>>();
    const usable = (entry: Snapshot<T> | undefined): entry is Snapshot<T> & { data: T; fetchedAt: number } =>
        entry?.data !== undefined && typeof entry.fetchedAt === "number" && entry.fetchedAt <= now() && now() - entry.fetchedAt < MAX_STALE_MS;

    function newer(left: Snapshot<T> | undefined, right: Snapshot<T> | undefined): Snapshot<T> | undefined {
        if (!left) return right;
        if (!right) return left;
        if ((right.fetchedAt ?? -1) > (left.fetchedAt ?? -1)) return right;
        if (right.fetchedAt === left.fetchedAt && right.retryAfter > left.retryAfter) return right;
        return left;
    }

    function remember(key: string, entry: Snapshot<T>): void {
        memory.delete(key);
        memory.set(key, entry);
        while (memory.size > maxEntries) memory.delete(memory.keys().next().value as string);
    }

    function retryKey(key: string): string {
        const url = new URL(key);
        url.searchParams.set("__retry", "1");
        return url.href;
    }

    async function read(key: string): Promise<Snapshot<T> | undefined> {
        let shared: Snapshot<T> | undefined;
        try {
            const response = await cache()?.match(key);
            if (response) {
                const value = (await response.json()) as Snapshot<T>;
                if (value && value.data !== undefined && Number.isFinite(value.fetchedAt) && value.retryAfter === 0) shared = value;
            }
        } catch {
            // Cache eviction, unavailable storage and corrupt entries must not block a refresh.
        }
        // A slow cache read may finish after another request refreshed this isolate.
        const entry = newer(shared, memory.get(key));
        if (entry) remember(key, entry);
        return entry;
    }

    async function readRetry(key: string): Promise<number> {
        try {
            const response = await cache()?.match(retryKey(key));
            if (response) {
                const value = (await response.json()) as { retryAfter?: number };
                if (typeof value?.retryAfter === "number" && Number.isFinite(value.retryAfter)) return value.retryAfter;
            }
        } catch {
            // A missing retry marker only loses the best-effort cross-isolate backoff.
        }
        return 0;
    }

    async function write(key: string, entry: Snapshot<T>): Promise<void> {
        remember(key, entry);
        const failed = entry.retryAfter > 0;
        const expires = failed ? entry.retryAfter : (entry.fetchedAt as number) + MAX_STALE_MS;
        try {
            // Failure markers have their own key: a racing failure must never erase success.
            await cache()?.put(
                failed ? retryKey(key) : key,
                new Response(JSON.stringify(failed ? { retryAfter: entry.retryAfter } : entry), {
                    headers: {
                        "Content-Type": "application/json",
                        "Cache-Control": `public, max-age=${Math.max(1, Math.ceil((expires - now()) / 1000))}`,
                    },
                }),
            );
        } catch {
            // Best effort edge storage; the bounded local fallback still benefits this isolate.
        }
    }

    async function refresh(key: string): Promise<T> {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                load(key, controller.signal),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error("Telegram refresh timed out"));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    async function run(key: string, maxAgeSeconds: number): Promise<T> {
        let entry = await read(key);
        if (usable(entry) && now() - entry.fetchedAt < maxAgeSeconds * 1000) return entry.data;
        const retryAfter = await readRetry(key);
        // Recheck local state after asynchronous storage reads before starting another refresh.
        entry = newer(entry, memory.get(key));
        if (usable(entry) && now() - entry.fetchedAt < maxAgeSeconds * 1000) return entry.data;
        if (Math.max(entry?.retryAfter ?? 0, retryAfter) > now()) {
            if (usable(entry)) return entry.data;
            throw new Error("Telegram refresh is temporarily unavailable");
        }
        const existing = pending.get(key);
        if (existing) return existing;
        const task = update(key).finally(() => pending.delete(key));
        pending.set(key, task);
        return task;
    }

    async function update(key: string): Promise<T> {
        try {
            const data = await refresh(key);
            await write(key, { data, fetchedAt: now(), retryAfter: 0 });
            return data;
        } catch (error) {
            // Another isolate may have succeeded while this refresh failed.
            const latest = await read(key);
            const fallback = usable(latest) ? latest : undefined;
            await write(key, { ...(fallback && { data: fallback.data, fetchedAt: fallback.fetchedAt }), retryAfter: now() + RETRY_MS });
            if (usable(fallback)) return fallback.data;
            throw error;
        }
    }

    return run;
}
