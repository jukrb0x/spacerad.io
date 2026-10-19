import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import * as nanostores from "nanostores";
import ts from "typescript";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

class Toggle extends EventTarget {
    dataset = {};
    attributes = new Map();
    label = { textContent: "" };
    writes = 0;

    setAttribute(name, value) {
        this.attributes.set(name, value);
        this.writes++;
    }

    querySelector(selector) {
        assert.equal(selector, "[data-theme-toggle-label]");
        return this.label;
    }

    click() {
        this.dispatchEvent(new Event("click", { cancelable: true }));
    }
}

function fixture() {
    const uiLanguage = nanostores.atom("en");
    const document = Object.assign(new EventTarget(), {
        documentElement: { dataset: {} },
        toggles: [new Toggle(), new Toggle()],
        querySelectorAll(selector) {
            assert.equal(selector, "[data-theme-toggle]");
            return this.toggles;
        },
    });
    const media = Object.assign(new EventTarget(), { matches: false });
    const storage = new Map();
    const context = createContext({
        document,
        window: { matchMedia: () => media },
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
        },
    });
    const cache = new Map();
    function evaluate(source, filename) {
        const { outputText } = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
            fileName: filename,
        });
        const exports = {};
        const require = (specifier) => {
            if (specifier === "nanostores") return nanostores;
            if (specifier === "../i18n/client") return { uiLanguage };
            return load(resolve(dirname(filename), `${specifier}.ts`));
        };
        runInContext(`(function(require, exports) {\n${outputText}\n})`, context, { filename })(require, exports);
        return exports;
    }
    function load(filename) {
        if (!cache.has(filename)) cache.set(filename, evaluate(readFileSync(filename, "utf8"), filename));
        return cache.get(filename);
    }
    const effects = load(resolve(projectRoot, "src/lib/theme-effects.ts"));
    const stores = load(resolve(projectRoot, "src/stores/theme.ts"));
    effects.initTheme();
    return {
        document,
        effects,
        stores,
        uiLanguage,
        mountComponent() {
            const filename = resolve(projectRoot, "src/components/ThemeToggle.astro");
            const script = readFileSync(filename, "utf8").match(/<script>([\s\S]*?)<\/script>/)?.[1];
            assert.ok(script, "ThemeToggle must have its module script");
            evaluate(script, filename);
        },
        systemChange(matches) {
            media.matches = matches;
            media.dispatchEvent(Object.assign(new Event("change"), { matches }));
        },
    };
}

const plainState = (state) => ({ theme: state.theme, preference: state.preference });

test("theme subscribers receive one initial state", () => {
    const { effects } = fixture();
    const states = [];
    effects.onThemeChange((state) => states.push(plainState(state)));
    assert.deepEqual(states, [{ theme: "light", preference: "system" }]);
});

test("preference changes deliver one settled state per subscriber and unsubscribe stops delivery", () => {
    const { effects, document } = fixture();
    const states = [];
    const otherStates = [];
    const otherUnsubscribe = effects.onThemeChange((state) => otherStates.push(plainState(state)));
    const unsubscribe = effects.onThemeChange((state) => {
        states.push(plainState(state));
        assert.equal(document.documentElement.dataset.theme, state.theme);
        assert.equal(document.documentElement.dataset.themeMode, state.preference);
    });
    states.length = 0;
    otherStates.length = 0;
    effects.setThemePreference("dark");
    effects.setThemePreference("dark");
    assert.deepEqual(states, [{ theme: "dark", preference: "dark" }]);
    assert.deepEqual(otherStates, [{ theme: "dark", preference: "dark" }]);
    unsubscribe();
    effects.setThemePreference("light");
    assert.equal(states.length, 1);
    assert.deepEqual(otherStates, [
        { theme: "dark", preference: "dark" },
        { theme: "light", preference: "light" },
    ]);
    otherUnsubscribe();
});

test("system changes notify subscribers only when the preference follows the system", () => {
    const { effects, systemChange } = fixture();
    const states = [];
    const unsubscribe = effects.onThemeChange((state) => states.push(plainState(state)));
    states.length = 0;
    systemChange(true);
    assert.deepEqual(states, [{ theme: "dark", preference: "system" }]);
    effects.setThemePreference("light");
    states.length = 0;
    systemChange(false);
    systemChange(true);
    assert.deepEqual(states, []);
    effects.setThemePreference("system");
    states.length = 0;
    systemChange(false);
    assert.deepEqual(states, [{ theme: "light", preference: "system" }]);
    unsubscribe();
    systemChange(true);
    assert.equal(states.length, 1);
});

test("the initial Astro page-load binds each control once", () => {
    const { document, mountComponent } = fixture();
    mountComponent();
    for (const toggle of document.toggles) assert.equal(toggle.writes, 0, "binding waits for Astro's initial page-load");
    document.dispatchEvent(new Event("astro:page-load"));
    for (const toggle of document.toggles) {
        assert.equal(toggle.writes, 2, "aria-label and title update once");
        assert.equal(toggle.dataset.themePreference, "system");
        assert.equal(toggle.dataset.themeNext, "light");
        assert.match(toggle.label.textContent, /System \(currently light\)/);
    }
});

test("ten swaps release old controls; the current click transitions and notifies once", () => {
    const { document, effects, stores, mountComponent } = fixture();
    mountComponent();
    document.dispatchEvent(new Event("astro:page-load"));
    const detached = [];
    for (let swap = 0; swap < 10; swap++) {
        const oldToggles = document.toggles;
        document.dispatchEvent(new Event("astro:before-swap"));
        const previous = effects.getThemeState().preference;
        oldToggles[0].click();
        assert.equal(effects.getThemeState().preference, previous, "disposed controls must lose their click handler before the swap");
        detached.push(...oldToggles);
        document.toggles = [new Toggle(), new Toggle()];
        document.dispatchEvent(new Event("astro:after-swap"));
        document.dispatchEvent(new Event("astro:page-load"));
    }
    const writes = detached.map((toggle) => toggle.writes);
    const states = [];
    effects.onThemeChange((state) => states.push(plainState(state)));
    states.length = 0;
    document.toggles[0].click();
    assert.equal(effects.getThemeState().preference, "light");
    assert.deepEqual(states, [{ theme: "light", preference: "light" }]);
    assert.deepEqual(
        detached.map((toggle) => toggle.writes),
        writes,
    );
    assert.equal(stores.themePreference.lc, 1, "only the global preference effect subscribes to the atom");
    for (const toggle of document.toggles) assert.equal(toggle.dataset.themePreference, "light");
});

test("page-load disposes the previous binding even without a preceding swap", () => {
    const { document, effects, mountComponent } = fixture();
    mountComponent();
    document.dispatchEvent(new Event("astro:page-load"));
    const previousToggles = document.toggles;
    const previousWrites = previousToggles.map((toggle) => toggle.writes);
    document.toggles = [new Toggle(), new Toggle()];
    document.dispatchEvent(new Event("astro:page-load"));
    previousToggles[0].click();
    assert.equal(effects.getThemeState().preference, "system");
    const writes = document.toggles.map((toggle) => toggle.writes);
    document.toggles[0].click();
    assert.equal(effects.getThemeState().preference, "light");
    assert.deepEqual(
        document.toggles.map((toggle, index) => toggle.writes - writes[index]),
        [2, 2],
    );
    assert.deepEqual(
        previousToggles.map((toggle) => toggle.writes),
        previousWrites,
    );
});

test("binding an already bound root adds no second update listener", () => {
    const { document, effects } = fixture();
    const dispose = effects.bindThemeToggles(document);
    const duplicateDispose = effects.bindThemeToggles(document);
    const writes = document.toggles.map((toggle) => toggle.writes);
    document.toggles[0].click();
    assert.deepEqual(
        document.toggles.map((toggle, index) => toggle.writes - writes[index]),
        [2, 2],
    );
    duplicateDispose?.();
    dispose();
    document.toggles[0].click();
    assert.equal(effects.getThemeState().preference, "light");
});

test("theme labels follow UI language and release subscriptions before navigation", () => {
    const { document, effects, uiLanguage, mountComponent } = fixture();
    mountComponent();
    document.dispatchEvent(new Event("astro:page-load"));
    assert.equal(uiLanguage.lc, 1);
    uiLanguage.set("zh");
    for (const toggle of document.toggles) {
        assert.equal(toggle.attributes.get("aria-label"), "当前主题：跟随系统。点击切换为浅色");
        assert.equal(toggle.attributes.get("title"), toggle.label.textContent);
    }
    document.toggles[0].click();
    assert.equal(effects.getThemeState().preference, "light");
    assert.match(document.toggles[0].label.textContent, /当前主题：浅色/);
    const detached = document.toggles;
    document.dispatchEvent(new Event("astro:before-swap"));
    assert.equal(uiLanguage.lc, 0);
    const writes = detached.map((toggle) => toggle.writes);
    document.toggles = [new Toggle(), new Toggle()];
    document.dispatchEvent(new Event("astro:page-load"));
    document.dispatchEvent(new Event("astro:page-load"));
    assert.equal(uiLanguage.lc, 1, "repeated page-load retains a single language subscription");
    uiLanguage.set("en");
    assert.match(document.toggles[0].label.textContent, /Current theme: Light Mode/);
    assert.deepEqual(
        detached.map((toggle) => toggle.writes),
        writes,
        "detached controls never receive language updates",
    );
});
