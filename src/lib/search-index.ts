type Hit = { token: string; score: number };
type SearchData = { url: string; meta?: { title?: string }; excerpt?: string };
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

let worker: Worker | undefined;
let sequence = 0;
let nextRequest = 0;
const pending = new Map<number, Pending>();
const aborted = () => new DOMException("Search cancelled", "AbortError");

function stop(error: Error) {
    sequence++;
    worker?.terminate();
    worker = undefined;
    for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
    }
    pending.clear();
}

function cancelSearch() {
    sequence++;
    if (pending.size) stop(aborted());
}

function request<T>(action: string, value: string): Promise<T> {
    if (!worker) {
        const active = new Worker(new URL("./search-worker.ts", import.meta.url), { type: "module" });
        worker = active;
        active.onerror = (event) => {
            event.preventDefault();
            if (worker === active) stop(new Error(event.message));
        };
        active.onmessage = ({ data }) => {
            if (worker !== active) return;
            if (data.fatal) return stop(new Error(data.error));
            const waiting = pending.get(data.id);
            if (!waiting) return;
            clearTimeout(waiting.timer);
            pending.delete(data.id);
            waiting.resolve(data.value);
        };
    }
    const active = worker;
    return new Promise<T>((resolve, reject) => {
        const id = ++nextRequest;
        const timer = setTimeout(() => {
            if (worker === active) stop(new Error("Search timed out. Try again."));
        }, 10000);
        pending.set(id, { resolve: (result) => resolve(result as T), reject, timer });
        active.postMessage({ id, action, value });
    });
}

const index = {
    async search(query: string) {
        cancelSearch();
        const current = sequence;
        if (!query.trim()) return { results: [] };
        const hits = await request<Hit[]>("search", query);
        return {
            results: hits.map((hit) => ({
                score: hit.score,
                data: () => (current === sequence ? request<SearchData>("data", hit.token) : Promise.reject(aborted())),
            })),
        };
    },
};

export async function loadSearchIndex() {
    return index;
}

// Idle indexes survive close/SPA; pending work must not outlive its UI owner.
document.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches("[data-search-input]")) cancelSearch();
});
document.addEventListener("astro:before-swap", cancelSearch);
document.addEventListener(
    "close",
    (event) => {
        if (event.target instanceof HTMLDialogElement && event.target.matches("[data-search-overlay]")) cancelSearch();
    },
    true,
);
window.addEventListener("pagehide", () => stop(aborted()));
