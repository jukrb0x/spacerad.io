import { type ChannelCacheStore, channelCacheKey, createChannelDataCache } from "./channel-cache.ts";
import { type FetchOptions, fetchTelegramChannel, type TelegramChannel } from "./telegram.ts";

const readChannel = createChannelDataCache<TelegramChannel>({
    cache: () => (globalThis.caches as unknown as { default?: ChannelCacheStore } | undefined)?.default,
    load: (key, signal) => {
        const url = new URL(key);
        const channel = url.pathname.split("/").pop() as string;
        const options: FetchOptions = {};
        for (const direction of ["before", "after"] as const) {
            const cursor = url.searchParams.get(direction);
            if (cursor) options[direction] = cursor;
        }
        return fetchTelegramChannel(channel, options, signal);
    },
});

export function getCachedTelegramChannel(channel: string, options: FetchOptions = {}, maxAgeSeconds = 300): Promise<TelegramChannel> {
    return readChannel(channelCacheKey(channel, options), maxAgeSeconds);
}
