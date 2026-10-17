import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

class Target {
    listeners = new Map();
    addEventListener(type, handler, options = {}) {
        const entries = this.listeners.get(type) || [];
        entries.push({ handler, signal: options.signal });
        this.listeners.set(type, entries);
    }
    dispatch(type, detail = {}) {
        for (const { handler, signal } of this.listeners.get(type) || []) {
            if (!signal?.aborted) handler({ target: this, preventDefault() {}, ...detail });
        }
    }
}
class Element extends Target {
    open = false;
    isConnected = true;
    value = "";
    children = [];
    dataset = {};
    classes = new Set();
    classList = {
        add: (...names) =>
            names.forEach((n) => {
                this.classes.add(n);
            }),
        remove: (...names) =>
            names.forEach((n) => {
                this.classes.delete(n);
            }),
        contains: (name) => this.classes.has(name),
    };
    setAttribute() {}
    showModal() {
        assert.ok(this.isConnected, "detached dialog must never reopen");
        this.open = true;
    }
    close() {
        this.open = false;
        this.dispatch("close");
    }
    focus() {}
    select() {}
    appendChild(child) {
        this.children.push(child);
    }
    replaceChildren() {
        this.children = [];
    }
    querySelectorAll() {
        return [];
    }
    closest() {
        return null;
    }
}
function fixture(pagefind = { init: async () => {}, search: async () => ({ results: [] }) }) {
    const document = new Target();
    const timers = new Map();
    let timerID = 0;
    let locked = 0;
    let nodes;
    const selectors = ["trigger", "overlay", "container", "input", "empty", "no-results", "list"];
    function swap() {
        if (nodes)
            Object.values(nodes).forEach((node) => {
                node.isConnected = false;
            });
        nodes = Object.fromEntries(selectors.map((key) => [key, new Element()]));
        document.activeElement = nodes.trigger;
    }
    swap();
    document.querySelector = (selector) => nodes[selector.match(/data-search-(.*?)\]/)?.[1]];
    document.querySelectorAll = () => [];
    document.createElement = () => new Element();
    const schedule = (fn) => {
        timers.set(++timerID, fn);
        return timerID;
    };
    const context = vm.createContext({
        document,
        Element,
        HTMLElement: Element,
        AbortController,
        console,
        requestAnimationFrame: schedule,
        cancelAnimationFrame: (id) => timers.delete(id),
        setTimeout: schedule,
        clearTimeout: (id) => timers.delete(id),
        require: (path) =>
            path.includes("scrollLock")
                ? { lockScrollForDialog: () => locked++, unlockScrollForDialog: () => locked-- }
                : { loadSearchIndex: async () => pagefind },
        exports: {},
        module: { exports: {} },
    });
    const source = readFileSync(new URL("../src/components/SearchOverlay.astro", import.meta.url), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInContext(
        ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        context,
    );
    document.dispatch("astro:page-load");
    return {
        document,
        swap,
        get nodes() {
            return nodes;
        },
        get locked() {
            return locked;
        },
        flush: async () => {
            for (const [id, fn] of [...timers]) {
                timers.delete(id);
                fn();
            }
            for (let i = 0; i < 12; i++) await Promise.resolve();
        },
        key: (key) => (key === "Escape" ? nodes.overlay.dispatch("cancel") : document.dispatch("keydown", { key, ctrlKey: key === "k" })),
    };
}
function deferred() {
    let resolve;
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
}
function results(title) {
    return { results: [{ data: async () => ({ url: "/posts/example/", meta: { title } }) }] };
}

test("repeated shortcut acquires one scroll lock; close releases it", async () => {
    const f = fixture();
    f.key("k");
    f.key("k");
    await f.flush();
    assert.equal(f.locked, 1);
    f.key("Escape");
    await f.flush();
    assert.equal(f.locked, 0);
});
test("page swaps dispose old shortcuts, frames, timers and scroll lock", async () => {
    const f = fixture();
    f.key("k");
    const old = f.nodes.overlay;
    f.document.dispatch("astro:before-swap");
    f.swap();
    f.document.dispatch("astro:after-swap");
    f.document.dispatch("astro:page-load");
    await f.flush();
    assert.equal(f.locked, 0);
    assert.equal(old.open, false);
    f.key("k");
    await f.flush();
    assert.equal(f.locked, 1);
    assert.equal(f.nodes.overlay.open, true);
});
test("a slower prior query cannot overwrite newer results", async () => {
    const old = deferred();
    const next = deferred();
    const f = fixture({ init: async () => {}, search: (query) => (query === "old" ? old.promise : next.promise) });
    f.key("k");
    await f.flush();
    f.nodes.input.value = "old";
    f.nodes.input.dispatch("input");
    await f.flush();
    f.nodes.input.value = "new";
    f.nodes.input.dispatch("input");
    await f.flush();
    next.resolve(results("new"));
    await f.flush();
    old.resolve(results("old"));
    await f.flush();
    assert.equal(f.nodes.list.children[0].children[0].children[0].textContent, "new");
});
test("closing invalidates an already pending search", async () => {
    const pending = deferred();
    const f = fixture({ init: async () => {}, search: () => pending.promise });
    f.key("k");
    await f.flush();
    f.nodes.input.value = "old";
    f.nodes.input.dispatch("input");
    await f.flush();
    f.key("Escape");
    await f.flush();
    pending.resolve(results("late"));
    await f.flush();
    assert.equal(f.nodes.list.children.length, 0);
});

function indexFixture() {
    const document = new Target();
    const window = new Target();
    const workers = [];
    const timers = new Map();
    let id = 0;
    class Worker {
        sent = [];
        terminated = false;
        constructor() {
            workers.push(this);
        }
        postMessage(message) {
            this.sent.push(message);
        }
        terminate() {
            this.terminated = true;
        }
        reply(data) {
            this.onmessage({ data });
        }
    }
    const context = vm.createContext({
        document,
        window,
        Worker,
        URL,
        DOMException,
        HTMLInputElement: Element,
        HTMLDialogElement: Element,
        exports: {},
        setTimeout: (fn) => {
            timers.set(++id, fn);
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
    });
    const source = readFileSync(new URL("../src/lib/search-index.ts", import.meta.url), "utf8").replaceAll(
        "import.meta.url",
        '"https://example.test/search-index.js"',
    );
    vm.runInContext(
        ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        context,
    );
    return { document, workers, timers, index: context.exports.loadSearchIndex() };
}
test("clearing the input terminates pending native work and clears its deadline", async () => {
    const f = indexFixture();
    const index = await f.index;
    const pending = index.search("Landscape");
    const rejected = assert.rejects(pending, { name: "AbortError" });
    const input = new Element();
    input.matches = (selector) => selector === "[data-search-input]";
    f.document.dispatch("input", { target: input });
    assert.equal(f.workers[0].terminated, true);
    assert.equal(f.timers.size, 0);
    await rejected;
});
test("late fatal messages from a cancelled realm cannot reject the newer query", async () => {
    const f = indexFixture();
    const index = await f.index;
    const old = index.search("Landscape");
    const rejected = assert.rejects(old, { name: "AbortError" });
    const next = index.search("Surgio");
    f.workers[0].reply({ fatal: true, error: "late failure" });
    const active = f.workers[1];
    active.reply({ id: active.sent[0].id, value: [] });
    assert.equal((await next).results.length, 0);
    assert.equal(active.terminated, false);
    await rejected;
});
test("expired data closures reject before sending tokens into a newer search", async () => {
    const f = indexFixture();
    const index = await f.index;
    const first = index.search("Landscape");
    const worker = f.workers[0];
    worker.reply({ id: worker.sent[0].id, value: [{ token: "1:0", score: 1 }] });
    const hit = (await first).results[0];
    const next = index.search("Surgio");
    const count = worker.sent.length;
    await assert.rejects(hit.data(), { name: "AbortError" });
    assert.equal(worker.sent.length, count);
    worker.reply({ id: worker.sent.at(-1).id, value: [] });
    await next;
});
test("SPA cancellation rejects concurrent fragment reads and clears every deadline", async () => {
    const f = indexFixture();
    const index = await f.index;
    const first = index.search("Landscape");
    const worker = f.workers[0];
    worker.reply({
        id: worker.sent[0].id,
        value: [
            { token: "1:0", score: 1 },
            { token: "1:1", score: 0.5 },
        ],
    });
    const results = (await first).results;
    const rejected = assert.rejects(Promise.all(results.map((hit) => hit.data())), { name: "AbortError" });
    f.document.dispatch("astro:before-swap");
    assert.equal(worker.terminated, true);
    assert.equal(f.timers.size, 0);
    await rejected;
});
test("the request deadline terminates a stalled realm instead of leaving readiness work alive", async () => {
    const f = indexFixture();
    const index = await f.index;
    const rejected = assert.rejects(index.search("Landscape"), /timed out/);
    [...f.timers.values()][0]();
    assert.equal(f.workers[0].terminated, true);
    assert.equal(f.timers.size, 0);
    await rejected;
});

function tocFixture() {
    const document = new Target();
    const toggle = new Element();
    const dialog = new Element();
    const content = new Element();
    let locked = 0;
    const timers = new Map();
    let id = 0;
    const schedule = (fn) => {
        timers.set(++id, fn);
        return id;
    };
    document.querySelector = (selector) =>
        ({ "[data-toc-mobile-toggle]": toggle, "[data-toc-mobile-drawer]": dialog, "[data-toc-mobile-content]": content })[selector];
    const context = vm.createContext({
        document,
        AbortController,
        console,
        requestAnimationFrame: schedule,
        cancelAnimationFrame: (id) => timers.delete(id),
        setTimeout: schedule,
        clearTimeout: (id) => timers.delete(id),
        require: (path) =>
            path.includes("scrollLock") ? { lockScrollForDialog: () => locked++, unlockScrollForDialog: () => locked-- } : { debounce: (fn) => fn },
        exports: {},
    });
    const source = readFileSync(new URL("../src/scripts/blog-interactive.ts", import.meta.url), "utf8");
    vm.runInContext(
        ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        context,
    );
    context.initMobileTocDrawer();
    return {
        toggle,
        dialog,
        document,
        get locked() {
            return locked;
        },
        flush() {
            for (const fn of timers.values()) fn();
            timers.clear();
        },
    };
}
test("mobile TOC open is idempotent and swap releases its scroll lock", () => {
    const f = tocFixture();
    f.toggle.dispatch("click");
    f.toggle.dispatch("click");
    assert.equal(f.locked, 1);
    f.document.dispatch("astro:before-swap");
    f.dialog.isConnected = false;
    f.flush();
    assert.equal(f.locked, 0);
    assert.equal(f.dialog.open, false);
    f.toggle.dispatch("click");
    assert.equal(f.locked, 0);
});
