import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

function fixture() {
    const frames = new Map();
    const timers = new Map();
    let id = 0;
    let locks = 0;
    let measured = 0;
    class Element extends EventTarget {
        attributes = new Map();
        classes = new Set();
        classList = {
            add: (...names) =>
                names.forEach((name) => {
                    this.classes.add(name);
                }),
            remove: (...names) =>
                names.forEach((name) => {
                    this.classes.delete(name);
                }),
            contains: (name) => this.classes.has(name),
        };
        setAttribute(name, value) {
            this.attributes.set(name, value);
        }
        getAttribute(name) {
            return this.attributes.get(name);
        }
        querySelector() {
            return null;
        }
        focus(options) {
            assert.equal(options.preventScroll, true);
            document.activeElement = this;
        }
        getBoundingClientRect() {
            measured++;
            return {};
        }
        click() {
            this.dispatchEvent(new Event("click"));
        }
    }
    const toggle = new Element();
    const drawer = new Element();
    const close = new Element();
    const link = new Element();
    const phrase = Object.assign(new Element(), {
        textContent: "",
        dataset: { navPhrases: JSON.stringify(["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"]) },
    });
    const overlay = Object.assign(new Element(), {
        open: false,
        showModal() {
            this.open = true;
        },
        close() {
            this.open = false;
        },
    });
    const document = Object.assign(new EventTarget(), {
        activeElement: toggle,
        querySelector: (selector) =>
            ({ "[data-nav-toggle]": toggle, "[data-nav-overlay]": overlay, "[data-nav-drawer]": drawer, "[data-nav-phrase]": phrase })[selector],
        querySelectorAll: (selector) => (selector === "[data-nav-close]" ? [close] : [link]),
    });
    const media = new EventTarget();
    const context = createContext({
        document,
        window: { matchMedia: () => media },
        AbortController,
        requestAnimationFrame: (fn) => {
            frames.set(++id, fn);
            return id;
        },
        cancelAnimationFrame: (key) => frames.delete(key),
        setTimeout: (fn) => {
            timers.set(++id, fn);
            return id;
        },
        clearTimeout: (key) => timers.delete(key),
    });
    const source = readFileSync(new URL("../src/components/NavDrawer.astro", import.meta.url), "utf8").match(/<script>([\s\S]*?)<\/script>/)[1];
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    runInContext(`(function(require, exports) { ${outputText} })`, context)(
        () => ({
            lockScrollForDialog: () => locks++,
            unlockScrollForDialog: () => locks--,
        }),
        {},
    );
    document.dispatchEvent(new Event("astro:page-load"));
    const flush = (queue) => {
        const callbacks = [...queue.values()];
        queue.clear();
        callbacks.forEach((fn) => {
            fn();
        });
    };
    return {
        toggle,
        close,
        link,
        phrase,
        overlay,
        document,
        media,
        frames,
        timers,
        frame: () => flush(frames),
        finish: () => flush(timers),
        locks: () => locks,
        measured: () => measured,
    };
}

test("first and repeated opens measure the initial state, focus without scrolling, and restore focus", () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) {
        f.toggle.click();
        assert.equal(f.overlay.open, true);
        assert.equal(f.overlay.classList.contains("is-open"), false);
        assert.equal(f.measured(), i + 1);
        assert.equal(f.locks(), 1);
        f.frame();
        assert.equal(f.overlay.classList.contains("is-open"), true);
        assert.equal(f.document.activeElement, f.link);
        f.close.click();
        f.finish();
        assert.equal(f.overlay.open, false);
        assert.equal(f.locks(), 0);
        assert.equal(f.document.activeElement, f.toggle);
    }
});

test("menu phrase changes only on a closed-to-open transition, including rapid reopening", () => {
    const f = fixture();
    const phrases = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"];
    assert.equal(f.phrase.textContent, "", "no autoplay while closed");
    let previous = "";
    for (let i = 0; i < 20; i++) {
        f.toggle.click();
        assert.ok(phrases.includes(f.phrase.textContent), "opening selects an existing wordmark phrase");
        assert.notEqual(f.phrase.textContent, previous, "successive openings never repeat");
        previous = f.phrase.textContent;
        f.frame();
        f.finish();
        assert.equal(f.phrase.textContent, previous, "frames and timers never change an open phrase");
        assert.equal(f.timers.size, 0, "open menu owns no phrase timer");
        f.close.click();
        f.close.click();
        assert.equal(f.phrase.textContent, previous, "closing does not select a phrase");
        if (i % 2 === 0) f.finish();
    }
    f.document.dispatchEvent(new Event("astro:before-swap"));
    f.frame();
    f.finish();
    assert.equal(f.phrase.textContent, previous, "route cleanup does not select a phrase");
});

test("close before opening frame and rapid close/reopen cancel stale callbacks", () => {
    const f = fixture();
    f.toggle.click();
    f.close.click();
    f.frame();
    assert.equal(f.overlay.classList.contains("is-open"), false);
    f.toggle.click();
    f.frame();
    f.finish();
    assert.equal(f.overlay.open, true);
    assert.equal(f.locks(), 1);
    f.close.click();
    f.finish();
    assert.equal(f.document.activeElement, f.toggle);
    assert.equal(f.locks(), 0);
});

test("route swap cancels opening frames and closing timers; desktop resize preserves other locks", () => {
    const f = fixture();
    f.media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
    assert.equal(f.locks(), 0, "closed navigation must not release another overlay's lock");
    f.toggle.click();
    f.document.dispatchEvent(new Event("astro:before-swap"));
    f.frame();
    f.finish();
    assert.equal(f.overlay.open, false);
    assert.equal(f.overlay.classList.contains("is-open"), false);
    assert.equal(f.locks(), 0);
    f.toggle.click();
    f.frame();
    f.close.click();
    f.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(f.timers.size, 0);
    assert.equal(f.overlay.open, false);
    f.toggle.click();
    f.frame();
    f.media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
    f.finish();
    assert.equal(f.overlay.open, false);
    assert.equal(f.locks(), 0);
});

test("compiled navigation CSS clips the outer animation without disabling inner vertical scrolling", async () => {
    const sass = await import("sass");
    const { css } = sass.compile(new URL("../src/styles/global.scss", import.meta.url).pathname, { logger: sass.Logger.silent });
    const declarations = (selector) =>
        [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
            .filter((match) => match[1].trim().split(/,\s*/).includes(selector))
            .map((match) => match[2])
            .join("\n");
    assert.match(declarations(".nav-drawer"), /overflow:\s*clip;/, "hidden is insufficient: it still allows focus-driven scrolling");
    assert.match(declarations("[data-scroll-container]"), /overflow-y:\s*auto;/);
    assert.match(declarations(".nav-drawer__panel"), /transform:\s*translateX\(100%\)/);
    assert.match(declarations(".nav-drawer.is-open .nav-drawer__panel"), /transform:\s*translateX\(0\)/);
});
