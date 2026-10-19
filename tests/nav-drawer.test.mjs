import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import { atom } from "nanostores";
import ts from "typescript";

function fixture() {
    const uiLanguage = atom("en");
    const frames = new Map();
    const timers = new Map();
    let id = 0;
    let locks = 0;
    let measured = 0;
    let selections = 0;
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
    function elements() {
        return {
            toggle: new Element(),
            drawer: new Element(),
            close: new Element(),
            link: new Element(),
            phrase: Object.assign(new Element(), {
                dataset: { navPhrases: JSON.stringify(["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"]) },
            }),
            phraseText: Object.assign(new Element(), { textContent: "" }),
            phraseStatus: Object.assign(new Element(), { textContent: "" }),
            overlay: Object.assign(new Element(), {
                open: false,
                style: { setProperty() {} },
                querySelectorAll: () => [current.link],
                showModal() {
                    this.open = true;
                },
                close() {
                    this.open = false;
                },
            }),
        };
    }
    let current = elements();
    const document = Object.assign(new EventTarget(), {
        activeElement: current.toggle,
        documentElement: { clientWidth: 390 },
        querySelector: (selector) =>
            ({
                "[data-nav-toggle]": current.toggle,
                "[data-nav-overlay]": current.overlay,
                "[data-nav-drawer]": current.drawer,
                "[data-nav-phrase]": current.phrase,
                "[data-nav-phrase-text]": current.phraseText,
                "[data-nav-phrase-status]": current.phraseStatus,
            })[selector],
        querySelectorAll: (selector) => (selector === "[data-nav-close]" ? [current.close] : []),
    });
    const media = new EventTarget();
    const context = createContext({
        document,
        window: { matchMedia: () => media },
        AbortController,
        Math: Object.assign(Object.create(Math), {
            random: () => {
                selections++;
                return 0;
            },
        }),
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
    runInContext(`(function(require, exports) { ${outputText} })`, context)((specifier) => {
        if (specifier === "../i18n/client") return { uiLanguage };
        assert.equal(specifier, "../utils/scrollLock");
        return {
            lockScrollForDialog: () => locks++,
            unlockScrollForDialog: () => locks--,
        };
    }, {});
    document.dispatchEvent(new Event("astro:page-load"));
    const flush = (queue) => {
        const callbacks = [...queue.values()];
        queue.clear();
        callbacks.forEach((fn) => {
            fn();
        });
    };
    return {
        get toggle() {
            return current.toggle;
        },
        get close() {
            return current.close;
        },
        get link() {
            return current.link;
        },
        get phrase() {
            return current.phrase;
        },
        get phraseText() {
            return current.phraseText;
        },
        get phraseStatus() {
            return current.phraseStatus;
        },
        get overlay() {
            return current.overlay;
        },
        replaceDOM: () => {
            current = elements();
            document.activeElement = current.toggle;
            document.dispatchEvent(new Event("astro:page-load"));
        },
        uiLanguage,
        selections: () => selections,
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

test("opening selects a phrase without autoplay, including rapid reopening", () => {
    const f = fixture();
    const phrases = ["太空来电", "宇宙频道", "星际广播", "I'm Jabriel", "智人大冲浪"];
    assert.equal(f.phraseText.textContent, "", "no autoplay while closed");
    let previous = "";
    for (let i = 0; i < 20; i++) {
        f.toggle.click();
        assert.ok(phrases.includes(f.phraseText.textContent), "opening selects an existing wordmark phrase");
        assert.notEqual(f.phraseText.textContent, previous, "successive openings never repeat");
        previous = f.phraseText.textContent;
        f.frame();
        f.finish();
        assert.equal(f.phraseText.textContent, previous, "frames and timers never change an open phrase");
        assert.equal(f.timers.size, 0, "open menu owns no phrase timer");
        f.close.click();
        f.close.click();
        assert.equal(f.phraseText.textContent, previous, "closing does not select a phrase");
        if (i % 2 === 0) f.finish();
    }
    f.document.dispatchEvent(new Event("astro:before-swap"));
    f.frame();
    f.finish();
    assert.equal(f.phraseText.textContent, previous, "route cleanup does not select a phrase");
});

test("phrase clicks advance once, retain focus, and reopening excludes the last clicked phrase", () => {
    const f = fixture();
    f.phrase.click();
    assert.equal(f.selections(), 0, "closed clicks do nothing");
    f.toggle.click();
    f.frame();
    assert.equal(f.phraseStatus.textContent, "", "opening does not announce a status");
    f.phrase.focus({ preventScroll: true });
    let previous = f.phraseText.textContent;
    for (let i = 0; i < 20; i++) {
        const count = f.selections();
        f.phrase.click();
        assert.equal(f.selections(), count + 1, "one activation selects exactly once");
        assert.notEqual(f.phraseText.textContent, previous);
        assert.equal(f.phraseStatus.textContent, f.phraseText.textContent);
        previous = f.phraseText.textContent;
        assert.equal(f.document.activeElement, f.phrase);
        assert.equal(f.overlay.open, true);
        assert.equal(f.toggle.getAttribute("aria-expanded"), "true");
        assert.equal(f.locks(), 1);
        assert.equal(f.frames.size, 0);
        assert.equal(f.timers.size, 0);
    }
    for (const finishClose of [false, true]) {
        f.close.click();
        assert.equal(f.phraseStatus.textContent, "");
        const count = f.selections();
        f.phrase.click();
        assert.equal(f.selections(), count, "closing animation does not accept clicks");
        if (finishClose) f.finish();
        f.phrase.click();
        assert.equal(f.selections(), count);
        f.toggle.click();
        f.frame();
        assert.notEqual(f.phraseText.textContent, previous);
        previous = f.phraseText.textContent;
    }
});

test("reinitializing an open drawer releases its lock and stale callbacks", () => {
    const f = fixture();
    for (const finishOpening of [false, true]) {
        f.toggle.click();
        if (finishOpening) f.frame();
        assert.equal(f.locks(), 1);
        f.document.dispatchEvent(new Event("astro:page-load"));
        assert.equal(f.locks(), 0, "disposing the open instance releases its lock");
        assert.equal(f.overlay.open, false);
        assert.equal(f.toggle.getAttribute("aria-expanded"), "false");
        assert.equal(f.frames.size, 0);
        assert.equal(f.timers.size, 0);
        const count = f.selections();
        f.toggle.click();
        f.frame();
        assert.equal(f.selections(), count + 1);
        assert.equal(f.locks(), 1);
        f.close.click();
        f.finish();
        assert.equal(f.locks(), 0);
    }
    f.toggle.click();
    f.frame();
    f.close.click();
    assert.equal(f.timers.size, 1);
    f.document.dispatchEvent(new Event("astro:page-load"));
    assert.equal(f.overlay.open, false, "re-init also finishes an interrupted close");
    assert.equal(f.timers.size, 0);
    assert.equal(f.locks(), 0);
});

test("SPA cleanup removes old phrase handlers and preserves the last selection across new DOM", () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) {
        f.document.dispatchEvent(new Event("astro:page-load"));
        f.document.dispatchEvent(new Event("astro:page-load"));
        let count = f.selections();
        f.toggle.click();
        f.frame();
        assert.equal(f.selections(), count + 1, "re-init does not duplicate opening handlers");
        count = f.selections();
        f.phrase.click();
        assert.equal(f.selections(), count + 1, "re-init does not duplicate click handlers");
        const previous = f.phraseText.textContent;
        const oldPhrase = f.phrase;
        const oldToggle = f.toggle;
        const oldOverlay = f.overlay;
        f.document.dispatchEvent(new Event("astro:before-swap"));
        assert.equal(f.phraseStatus.textContent, "");
        assert.equal(f.frames.size, 0);
        assert.equal(f.timers.size, 0);
        assert.equal(f.locks(), 0);
        count = f.selections();
        oldToggle.click();
        // Even a stale element artificially reopened cannot activate its removed handler.
        oldOverlay.open = true;
        oldToggle.setAttribute("aria-expanded", "true");
        oldPhrase.click();
        assert.equal(f.selections(), count);
        f.replaceDOM();
        f.toggle.click();
        f.frame();
        assert.notEqual(f.phraseText.textContent, previous);
        assert.equal(f.phraseStatus.textContent, "");
        f.close.click();
        f.finish();
    }
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
    f.replaceDOM();
    f.toggle.click();
    f.frame();
    f.close.click();
    f.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(f.timers.size, 0);
    assert.equal(f.overlay.open, false);
    f.replaceDOM();
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

test("language changes describe current drawer state and dispose with the DOM binding", () => {
    const f = fixture();
    assert.equal(f.uiLanguage.lc, 1);
    f.uiLanguage.set("zh");
    assert.equal(f.toggle.getAttribute("aria-label"), "打开导航菜单");
    f.toggle.click();
    assert.equal(f.toggle.getAttribute("aria-label"), "关闭导航菜单");
    f.uiLanguage.set("en");
    assert.equal(f.toggle.getAttribute("aria-label"), "Close navigation menu");
    const detached = f.toggle;
    f.document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(f.uiLanguage.lc, 0, "swap disposes the language subscriber");
    const labelAfterCleanup = detached.getAttribute("aria-label");
    f.replaceDOM();
    f.document.dispatchEvent(new Event("astro:page-load"));
    assert.equal(f.uiLanguage.lc, 1, "reinitializing does not accumulate language subscriptions");
    f.uiLanguage.set("zh");
    assert.equal(f.toggle.getAttribute("aria-label"), "打开导航菜单");
    assert.equal(detached.getAttribute("aria-label"), labelAfterCleanup, "detached control does not receive language updates");
});
