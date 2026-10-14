import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const sources = ["src/scripts/likes.ts", "src/utils/spaLifecycle.ts"].map(
    (path) =>
        ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText,
);

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

class Button extends EventTarget {
    constructor(slug) {
        super();
        this.dataset = { slug };
        this.attributes = new Set();
        this.classList = { add() {}, remove() {} };
        this.count = { textContent: "" };
    }
    setAttribute(name) {
        this.attributes.add(name);
    }
    removeAttribute(name) {
        this.attributes.delete(name);
    }
    hasAttribute(name) {
        return this.attributes.has(name);
    }
    querySelectorAll(selector) {
        assert.equal(selector, "[data-like-count]");
        return [this.count];
    }
    cloneNode() {
        const clone = new Button(this.dataset.slug);
        clone.attributes = new Set(this.attributes);
        clone.count.textContent = this.count.textContent;
        return clone;
    }
}

function setup(initial = {}) {
    let stored = JSON.stringify(initial);
    let storageFails = false;
    const requests = [];
    const errors = [];
    const document = Object.assign(new EventTarget(), {
        readyState: "complete",
        buttons: [],
        querySelectorAll(selector) {
            if (selector === "[data-like-button]") return this.buttons;
            assert.equal(selector, "[data-like-count]");
            return this.buttons.map((button) => button.count);
        },
    });
    const context = vm.createContext({
        document,
        AbortController,
        setTimeout() {},
        console: { error: (...args) => errors.push(args) },
        localStorage: {
            getItem() {
                if (storageFails) throw Error("storage unavailable");
                return stored;
            },
            setItem(_key, value) {
                if (storageFails) throw Error("storage unavailable");
                stored = value;
            },
        },
        fetch(url, options) {
            const pending = deferred();
            requests.push({ url, options, ...pending });
            return pending.promise;
        },
    });
    function load(source) {
        const exports = {};
        const require = (path) => {
            assert.equal(path, "../utils/spaLifecycle");
            return load(sources[1]);
        };
        vm.runInContext(`(function(require, exports) { ${source}\n})`, context)(require, exports);
        return exports;
    }
    const likes = load(sources[0]);
    function show(...slugs) {
        document.buttons = slugs.map((slug) => new Button(slug));
        for (const button of document.buttons) {
            button.parentNode = {
                replaceChild(next, previous) {
                    document.buttons[document.buttons.indexOf(previous)] = next;
                    next.parentNode = previous.parentNode;
                },
            };
        }
        document.dispatchEvent(new Event("astro:page-load"));
        return document.buttons;
    }
    return {
        document,
        likes,
        requests,
        errors,
        show,
        storage: () => JSON.parse(stored),
        failStorage: () => {
            storageFails = true;
        },
    };
}

async function respond(request, count, userLikes) {
    request.resolve({ ok: true, json: async () => ({ count, userLikes }) });
    await new Promise(setImmediate);
}

test("previous article GET cannot overwrite current article or its storage", async () => {
    const app = setup();
    app.show("old");
    app.document.dispatchEvent(new Event("astro:before-swap"));
    const buttons = app.show("current", "current");
    await respond(app.requests[1], 200, 2);
    await respond(app.requests[0], 100, 1);
    assert.deepEqual(
        buttons.map((button) => button.count.textContent),
        ["200", "200"],
    );
    assert.deepEqual(app.storage(), { current: 2 });
});

test("returning to the same slug does not revive a previous route read", async () => {
    const app = setup();
    app.show("same");
    app.document.dispatchEvent(new Event("astro:before-swap"));
    app.show("other");
    app.document.dispatchEvent(new Event("astro:before-swap"));
    const [button] = app.show("same");
    await respond(app.requests[2], 300, 3);
    await respond(app.requests[0], 100, 1);
    assert.equal(button.count.textContent, "300");
    assert.deepEqual(app.storage(), { same: 3 });
});

test("swap invalidates a GET whose JSON is still pending", async () => {
    const app = setup();
    const [button] = app.show("old");
    const body = deferred();
    app.requests[0].resolve({ ok: true, json: () => body.promise });
    await new Promise(setImmediate);
    app.document.dispatchEvent(new Event("astro:before-swap"));
    body.resolve({ count: 100, userLikes: 1 });
    await new Promise(setImmediate);
    assert.equal(button.count.textContent, "");
    assert.deepEqual(app.storage(), {});
});

test("a newer read supersedes an older read on the same route", async () => {
    const app = setup();
    const [button] = app.show("same");
    const latest = app.likes.fetchLikeStatus("same");
    await respond(app.requests[1], 200, 2);
    await latest;
    await respond(app.requests[0], 100, 1);
    assert.equal(button.count.textContent, "200");
    assert.deepEqual(app.storage(), { same: 2 });
});

test("GET and POST update only buttons and counts for the requested slug", async () => {
    const app = setup();
    const [first, second, other] = app.show("target", "target", "other");
    await respond(app.requests[0], 20, 1);
    assert.deepEqual([first.count.textContent, second.count.textContent, other.count.textContent], ["20", "20", ""]);
    first.dispatchEvent(new Event("click"));
    assert.equal(app.requests[1].url, "/api/like");
    assert.equal(app.requests[1].options.method, "POST");
    assert.deepEqual(JSON.parse(app.requests[1].options.body), { slug: "target" });
    await respond(app.requests[1], 21, 2);
    assert.deepEqual([first.count.textContent, second.count.textContent, other.count.textContent], ["21", "21", ""]);
    assert.equal(other.hasAttribute("data-liked"), false);
});

test("delayed POST persists its slug without clobbering the new route or other stored likes", async () => {
    const app = setup({ untouched: 4 });
    const [oldButton] = app.show("old");
    await respond(app.requests[0], 10, 0);
    oldButton.dispatchEvent(new Event("click"));
    app.document.dispatchEvent(new Event("astro:before-swap"));
    const [button] = app.show("current");
    await respond(app.requests[2], 200, 16);
    await respond(app.requests[1], 11, 1);
    assert.equal(button.count.textContent, "200");
    assert.equal(button.hasAttribute("data-max-reached"), true);
    assert.deepEqual(app.storage(), { untouched: 4, old: 1, current: 16 });
});

test("a like invalidates its pending GET and delayed POSTs preserve newer local likes", async () => {
    const app = setup();
    const [button] = app.show("target");
    button.dispatchEvent(new Event("click"));
    button.dispatchEvent(new Event("click"));
    await respond(app.requests[1], 11, 1);
    assert.deepEqual(app.storage(), { target: 2 });
    await respond(app.requests[2], 12, 2);
    await respond(app.requests[0], 10, 0);
    assert.equal(button.count.textContent, "12");
    assert.deepEqual(app.storage(), { target: 2 });
});

test("storage failure leaves status UI and POST requests working", async () => {
    const app = setup();
    app.failStorage();
    const [button] = app.show("target");
    await respond(app.requests[0], 10, 1);
    assert.equal(button.count.textContent, "10");
    const adding = assert.doesNotReject(app.likes.addLike("target"));
    if (app.requests[1]) await respond(app.requests[1], 11, 2);
    await adding;
    assert.equal(app.requests.length, 2);
    assert.equal(button.count.textContent, "11");
});

test("failed requests retain local likes and maximum prevents further POSTs", async () => {
    const app = setup({ target: 15 });
    const [button] = app.show("target");
    app.requests[0].reject(Error("offline"));
    await new Promise(setImmediate);
    assert.equal(button.count.textContent, "15");
    const adding = app.likes.addLike("target");
    app.requests[1].reject(Error("offline"));
    await adding;
    assert.deepEqual(app.storage(), { target: 16 });
    await app.likes.addLike("target");
    assert.equal(app.requests.length, 2);
    assert.equal(app.errors.length, 2);
});

test("an earlier POST cannot roll back a later POST on the same article", async () => {
    const app = setup();
    const [button] = app.show("target");
    await respond(app.requests[0], 10, 0);
    button.dispatchEvent(new Event("click"));
    button.dispatchEvent(new Event("click"));
    await respond(app.requests[2], 12, 2);
    await respond(app.requests[1], 11, 1);
    assert.equal(button.count.textContent, "12");
    assert.deepEqual(app.storage(), { target: 2 });
});
