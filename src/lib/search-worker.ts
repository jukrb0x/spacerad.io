/// <reference lib="webworker" />
export {};
const scope = self as unknown as DedicatedWorkerGlobalScope;
type Hit = { score: number; data: () => Promise<{ content: string }> };
type NativeIndex = { search: (query: string) => Promise<{ results: Hit[] }> };
let failed = false;
function fatal(error: unknown) {
    if (failed) return;
    failed = true;
    scope.postMessage({ fatal: true, error: String(error) });
    scope.close();
}

// Pagefind 1.4 swallows failed chunk loads; reject them before it can cache emptiness.
const nativeFetch = scope.fetch.bind(scope);
scope.fetch = async (...args) => {
    try {
        const response = await nativeFetch(...args);
        if (!response.ok) throw new Error(`Search asset returned HTTP ${response.status}`);
        const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]));
        if (!/\.pf_(index|filter)$/.test(url.pathname)) return response;
        const body = await response.arrayBuffer();
        const bytes = new Uint8Array(body);
        let decoded = body;
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
            const stream = new DecompressionStream("gzip");
            [decoded] = await Promise.all([
                new Response(stream.readable).arrayBuffer(),
                (async () => {
                    const writer = stream.writable.getWriter();
                    await writer.write(body);
                    await writer.close();
                })(),
            ]);
        }
        if (new TextDecoder().decode(decoded.slice(0, 12)) !== "pagefind_dcd") throw new Error("Invalid search index chunk");
        // Pinned Pagefind accepts its signature-prefixed uncompressed chunks.
        return new Response(decoded);
    } catch (error) {
        fatal(error);
        throw error;
    }
};
scope.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    fatal(event.reason);
});

let runtime: Promise<NativeIndex[]> | undefined;
let queryID = 0;
let hits: Hit[] = [];
scope.onmessage = async ({ data: { id, action, value } }) => {
    try {
        runtime ??= Promise.all(
            ["en", "zh-cn"].map(async (language) => {
                const path = new URL("/pagefind/pagefind.js", scope.location.origin);
                path.searchParams.set("language", language);
                const index = await import(/* @vite-ignore */ path.href);
                await index.options({ language, basePath: new URL("/pagefind/", scope.location.origin).href, baseUrl: "/" });
                await index.init();
                return index as NativeIndex;
            }),
        );
        const indexes = await runtime;
        if (action === "search") {
            const search = async (query: string): Promise<Hit[]> =>
                (await Promise.all(indexes.map((index) => index.search(query))))
                    .flatMap((result) => result.results)
                    .sort((a, b) => b.score - a.score);
            hits = await search(value);
            // shortcut: check ten Han phrase candidates; revisit if phrase recall exceeds this window.
            if (!hits.length && value.length <= 200 && /^"\p{Script=Han}+"$/u.test(value.trim())) {
                const phrase = value.trim().slice(1, -1);
                const candidates = await Promise.all((await search(phrase)).slice(0, 10).map(async (hit) => ({ hit, data: await hit.data() })));
                hits = candidates.filter(({ data }) => data.content.includes(phrase)).map(({ hit, data }) => ({ ...hit, data: async () => data }));
            }
            queryID = id;
            scope.postMessage({ id, value: hits.map((hit, position) => ({ token: `${id}:${position}`, score: hit.score })) });
        } else {
            const [query, position] = value.split(":").map(Number);
            if (query !== queryID || !hits[position]) throw new Error("Search result expired");
            scope.postMessage({ id, value: await hits[position].data() });
        }
    } catch (error) {
        fatal(error);
    }
};
