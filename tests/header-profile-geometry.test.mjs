import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/scripts/header-scroll.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });

// Execute the real controller; the doubles provide layout snapshots without a browser.
function fixture(navigationHeight = 70, profileHeight = 90, headerInset = 0) {
    const origin = 28;
    const attributes = new Set();
    const values = new Map();
    const frames = new Map();
    let frameId = 0;
    let paintedBottom = navigationHeight;
    let dialogOpen = false;
    const style = { setProperty: (key, value) => values.set(key, value) };
    const window = Object.assign(new EventTarget(), { scrollY: 0, innerHeight: 800 });
    const profileLink = {
        offsetHeight: 40,
        inert: false,
        getBoundingClientRect: () => ({ top: origin + headerInset + navigationHeight + 16 - window.scrollY }),
    };
    const profile = {
        offsetHeight: profileHeight,
        querySelector: () => profileLink,
        getBoundingClientRect: () => ({ top: origin + headerInset + navigationHeight - window.scrollY }),
    };
    const navigation = {
        offsetHeight: navigationHeight,
        contains: (element) => element === navigation,
        getAnimations: () => [],
        getBoundingClientRect: () => ({
            bottom: attributes.has("data-nav-floating") ? paintedBottom : origin + headerInset - window.scrollY + navigationHeight,
        }),
        inert: false,
    };
    const header = {
        style,
        getBoundingClientRect: () => ({ top: origin - window.scrollY }),
        querySelector: (selector) => (selector === ".site-header__inner" ? navigation : selector === ".home-profile" ? profile : null),
        toggleAttribute(key, enabled) {
            if (enabled) attributes.add(key);
            else attributes.delete(key);
        },
        setAttribute: (key) => attributes.add(key),
        removeAttribute: (key) => attributes.delete(key),
    };
    const document = Object.assign(new EventTarget(), {
        activeElement: null,
        documentElement: { style, scrollHeight: 3000 },
        querySelector: (selector) => (selector === "[data-header]" ? header : selector === "dialog[open]" && dialogOpen ? {} : null),
    });
    const context = createContext({
        window,
        document,
        getComputedStyle: () => ({
            paddingTop: `${headerInset}px`,
            getPropertyValue: (name) =>
                ({
                    "--page-wash-stop-1": "45px",
                    "--page-wash-level-1": "0.8",
                    "--page-wash-stop-2": "95px",
                    "--page-wash-level-2": "0.4",
                    "--page-wash-stop-3": "140px",
                    "--page-wash-level-3": "0.1",
                })[name] ?? "",
        }),
        requestAnimationFrame(callback) {
            frames.set(++frameId, callback);
            return frameId;
        },
        cancelAnimationFrame: (id) => frames.delete(id),
    });
    runInContext(outputText, context);
    document.dispatchEvent(new Event("astro:page-load"));
    return {
        dialog(open) {
            dialogOpen = open;
        },
        focusNavigation(focused) {
            document.activeElement = focused ? navigation : null;
        },
        scroll(distance, bottom) {
            paintedBottom = bottom;
            window.scrollY = origin + headerInset + distance;
            window.dispatchEvent(new Event("scroll"));
            for (const [id, callback] of [...frames]) {
                frames.delete(id);
                callback();
            }
        },
        sample() {
            const distance = window.scrollY - origin - headerInset;
            const active = attributes.has("data-profile-return");
            const number = (name) => Number.parseFloat(values.get(name)) || 0;
            const shift = active ? number("--profile-return-shift") : 0;
            const clipTop = active ? number("--profile-return-top") : 0;
            const clipBottom = active ? number("--profile-return-bottom") : 0;
            return {
                active,
                shift,
                clipTop,
                clipBottom,
                top: navigationHeight - distance + shift + clipTop,
                bottom: navigationHeight - distance + profileHeight + shift - clipBottom,
                naturalBottom: navigationHeight - distance + profileHeight,
                contentTop: navigationHeight - distance + 16 + shift,
                linkInert: profileLink.inert,
                floating: attributes.has("data-nav-floating"),
                hidden: attributes.has("data-nav-hidden"),
                inert: navigation.inert,
            };
        },
    };
}
function reveal(f, distance, bottom) {
    f.scroll(700, 0);
    f.scroll(636, 1);
    f.scroll(distance, bottom);
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("mobile top spacing uses the navigation origin for floating and the natural handoff", () => {
    const f = fixture(60, 62, 16);
    f.scroll(59, 0);
    assert.equal(f.sample().floating, false, "the last pixel of normal navigation remains visible");
    f.scroll(60, 0);
    assert.equal(f.sample().floating, true);
    reveal(f, 2, 60);
    f.scroll(0, 60);
    const natural = f.sample();
    assert.equal(natural.floating, false, "return to flow at the navigation's original top");
    assert.equal(natural.active, false);
    near(natural.contentTop, 76);
});

// At a fixed scroll position, only the drawer and its occlusion boundary may move.
for (const height of [70, 64]) {
    test(`profile content stays still through drawer entrance, exit and interruption (${height}px)`, () => {
        const f = fixture(height);
        const distance = height - 8;
        reveal(f, distance, 0);
        const expectedTop = height - distance + 16;
        for (const fraction of [0, 0.1, 0.5, 0.9, 1, 0.75, 0.4, 0.8, 0.2, 0]) {
            f.scroll(distance, height * fraction);
            const geometry = f.sample();
            near(geometry.shift, 0);
            near(geometry.contentTop, expectedTop);
            near(geometry.bottom, geometry.naturalBottom);
        }
    });
}

test("profile content follows document scrolling without a second navigation displacement", () => {
    const f = fixture();
    reveal(f, 200, 70);
    for (const distance of [140, 80, 62, 48, 24, 1, 0.5, 0, 0.5, 1, 24, 48, 80]) {
        f.scroll(distance, 70);
        near(f.sample().contentTop + distance, 86);
        near(f.sample().bottom, f.sample().naturalBottom);
    }
});

test("paint boundary follows the drawer while content remains at its natural position", () => {
    // Fractional step sizes exercise controller math, not real browser DPR or rasterization.
    for (const height of [64, 70])
        for (const step of [1, 1 / 1.25, 1 / 1.5, 1 / 2, 1 / 3])
            for (const fraction of [0.01, 0.5, 0.99, 1]) {
                const f = fixture(height);
                reveal(f, height + 2, height * fraction);
                for (let distance = height + 2; distance > 0; distance -= step) {
                    const bottom = height * fraction;
                    f.scroll(distance, bottom);
                    const geometry = f.sample();
                    near(geometry.top, bottom);
                    near(geometry.contentTop, height - distance + 16);
                    near(geometry.bottom, geometry.naturalBottom);
                    const inkTop = Math.max(geometry.top, geometry.contentTop, 0);
                    const inkBottom = Math.min(geometry.bottom, geometry.contentTop + 40);
                    if (inkBottom > inkTop) assert.ok(inkTop >= bottom - 1e-9);
                }
            }
});

test("near-top background connects at the fully hidden endpoint without dragging text", () => {
    const f = fixture();
    reveal(f, 38, 70);
    for (const bottom of [35, 0.01, 0]) {
        f.scroll(62, bottom);
        const geometry = f.sample();
        assert.equal(geometry.active, true);
        near(geometry.top, bottom);
        near(geometry.contentTop, 24);
        near(geometry.bottom, 98);
    }
    assert.equal(f.sample().hidden, true);
    assert.equal(f.sample().inert, true);
});

test("natural top handoff preserves content position even with a partly hidden drawer", () => {
    for (const bottom of [0, 35, 70]) {
        const f = fixture();
        reveal(f, 6, 70);
        f.scroll(30, 0);
        f.scroll(0.5, bottom);
        near(f.sample().contentTop, 85.5);
        f.scroll(0, 70);
        const natural = f.sample();
        near(natural.contentTop, 86);
        assert.equal(natural.active, false);
        assert.equal(natural.floating, false);
        assert.equal(natural.hidden, false);
        assert.equal(natural.inert, false);
        assert.equal(natural.linkInert, false);
    }
});

test("clipped profile links cannot receive focus and return when their ink is uncovered", () => {
    const f = fixture();
    reveal(f, 48, 70);
    assert.equal(f.sample().linkInert, true);
    f.scroll(48, 20);
    assert.equal(f.sample().linkInert, false);
    f.scroll(200, 35);
    const masked = f.sample();
    near(masked.clipTop, 90);
    near(masked.clipBottom, 0);
    near(masked.shift, 0);
    assert.equal(masked.linkInert, true);
});

test("menu scroll locks and focused navigation do not reintroduce profile displacement", () => {
    const f = fixture();
    reveal(f, 62, 70);
    f.dialog(true);
    f.scroll(90, 70);
    assert.equal(f.sample().hidden, false);
    near(f.sample().shift, 0);
    f.dialog(false);
    f.focusNavigation(true);
    f.scroll(130, 70);
    assert.equal(f.sample().hidden, false);
    assert.equal(f.sample().inert, false);
    near(f.sample().contentTop, -44);
});
