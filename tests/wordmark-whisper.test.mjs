import assert from "node:assert/strict";
import test from "node:test";

test("wordmark whisper is brief, stable, keyboard-friendly, touch-safe and route-owned", async () => {
    const document = new EventTarget();
    const timers = new Map();
    let timerId = 0;
    let wide = true;
    let finePointer = true;
    let focusVisible = true;
    const phrases = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"];
    function header() {
        const attributes = new Set();
        const whisper = {
            textContent: "",
            hasAttribute: key => attributes.has(key),
            getBoundingClientRect: () => ({ right: 350 }),
            setAttribute: (key) => attributes.add(key),
            removeAttribute: (key) => attributes.delete(key),
            visible: () => attributes.has("data-visible"),
        };
        const trigger = Object.assign(new EventTarget(), {
            dataset: { wordmarkPhrases: JSON.stringify(phrases) },
            querySelector: () => whisper,
            matches: () => focusVisible,
            closest: () => ({ querySelector: () => ({ getBoundingClientRect: () => ({ left: 500 }) }) }),
        });
        return { trigger, whisper };
    }
    const oldGlobals = {
        ResizeObserver: globalThis.ResizeObserver,
        document: globalThis.document,
        window: globalThis.window,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
    };
    let current = header();
    document.querySelector = () => current.trigger;
    globalThis.document = document;
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.window = { addEventListener() {}, matchMedia: (query) => ({ matches: query.includes("min-width") ? wide : finePointer }) };
    globalThis.setTimeout = (callback, delay) => {
        assert.equal(delay, 2500);
        timers.set(++timerId, callback);
        return timerId;
    };
    globalThis.clearTimeout = (id) => timers.delete(id);
    const pointer = (type = "mouse") => current.trigger.dispatchEvent(Object.assign(new Event("pointerenter"), { pointerType: type }));
    try {
        await import("../src/scripts/wordmark-whisper.ts");
        document.dispatchEvent(new Event("astro:page-load"));
        assert.equal(current.whisper.visible(), false, "no automatic animation");
        pointer();
        assert.equal(current.whisper.visible(), true);
        assert.ok(phrases.includes(current.whisper.textContent));
        const first = current.whisper.textContent;
        pointer();
        assert.notEqual(current.whisper.textContent, first, "never repeat a phrase immediately");
        assert.equal(timers.size, 1, "repeated entry owns only one timer");
        [...timers.values()][0]();
        assert.equal(current.whisper.visible(), false, "hides after 2.5 seconds");
        current.trigger.dispatchEvent(new Event("focus"));
        assert.equal(current.whisper.visible(), true, "keyboard focus reveals phrase");
        current.trigger.dispatchEvent(new Event("blur"));
        assert.equal(current.whisper.visible(), false);
        focusVisible = false;
        current.trigger.dispatchEvent(new Event("focus"));
        assert.equal(current.whisper.visible(), false, "touch-style focus never reveals it");
        pointer("touch");
        assert.equal(current.whisper.visible(), false);
        finePointer = false;
        pointer();
        assert.equal(current.whisper.visible(), false);
        finePointer = true;
        wide = false;
        pointer();
        assert.equal(current.whisper.visible(), true, "compact header still reveals the phrase");
        wide = true;
        pointer();
        const old = current;
        document.dispatchEvent(new Event("astro:before-swap"));
        assert.equal(old.whisper.visible(), false);
        assert.equal(timers.size, 0, "route cleanup clears delayed work");
        old.trigger.dispatchEvent(Object.assign(new Event("pointerenter"), { pointerType: "mouse" }));
        assert.equal(old.whisper.visible(), false, "old DOM listeners are removed");
        current = header();
        document.dispatchEvent(new Event("astro:page-load"));
        document.dispatchEvent(new Event("astro:page-load"));
        pointer();
        assert.equal(timers.size, 1, "reinitializing does not duplicate listeners");
        const click = new Event("click", { cancelable: true });
        current.trigger.dispatchEvent(click);
        assert.equal(click.defaultPrevented, false, "normal home navigation remains intact");
        assert.equal(current.whisper.visible(), false);
        document.dispatchEvent(new Event("astro:before-swap"));
    } finally {
        Object.assign(globalThis, oldGlobals);
    }
});
