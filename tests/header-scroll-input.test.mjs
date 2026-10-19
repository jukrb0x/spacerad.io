import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("../src/scripts/header-scroll.ts", import.meta.url), "utf8");

function fixture() {
    class Transition {
        transitionProperty = "transform";
        playState = "finished";
    }
    const transition = new Transition();
    const paint = new Map();
    let navigationBottom = 64;
    const frames = new Map();
    let frameId = 0;
    let dialogOpen = false;
    let navigation;
    let header;
    const window = Object.assign(new EventTarget(), { scrollY: 0, innerHeight: 844 });
    const document = Object.assign(new EventTarget(), {
        activeElement: null,
        documentElement: { style: { setProperty() {} }, scrollHeight: 5000 },
        querySelector: (selector) => (selector === "[data-header]" ? header : selector === "dialog[open]" && dialogOpen ? {} : null),
    });
    function mount() {
        const attributes = new Set();
        navigation = {
            offsetHeight: 64,
            contains: (el) => el === navigation,
            getBoundingClientRect: () => ({ bottom: navigationBottom }),
            getAnimations: () => [transition],
            inert: false,
        };
        header = {
            attributes,
            style: { setProperty: (key, value) => paint.set(key, value) },
            getBoundingClientRect: () => ({ top: 28 - window.scrollY }),
            querySelector: (selector) => (selector === ".site-header__inner" ? navigation : null),
            toggleAttribute: (key, value) => (value ? attributes.add(key) : attributes.delete(key)),
            setAttribute: (key) => attributes.add(key),
            removeAttribute: (key) => attributes.delete(key),
        };
    }
    mount();
    runInContext(
        stripTypeScriptTypes(source),
        createContext({
            window,
            document,
            CSSTransition: Transition,
            getComputedStyle: () => ({ paddingTop: "0px" }),
            requestAnimationFrame: (callback) => {
                frames.set(++frameId, callback);
                return frameId;
            },
            cancelAnimationFrame: (id) => frames.delete(id),
        }),
    );
    const flush = () => {
        for (const [id, callback] of [...frames]) {
            frames.delete(id);
            callback();
        }
    };
    document.dispatchEvent(new Event("astro:page-load"));
    return {
        animation(bottom, running) {
            navigationBottom = bottom;
            transition.playState = running ? "running" : "finished";
            flush();
        },
        paint: () => paint.get("--page-wash-nav-offset"),
        pendingFrames: () => frames.size,
        input(type) {
            document.dispatchEvent(new Event(type));
            flush();
        },
        focus() {
            document.activeElement = navigation;
            document.dispatchEvent(new Event("focusin"));
            flush();
        },
        dialog(value) {
            dialogOpen = value;
        },
        scroll(y) {
            window.scrollY = y;
            window.dispatchEvent(new Event("scroll"));
            flush();
        },
        hidden: () => header.attributes.has("data-nav-hidden"),
        inert: () => navigation.inert,
        swap() {
            const previous = header;
            document.dispatchEvent(new Event("astro:before-swap"));
            document.activeElement = null;
            mount();
            document.dispatchEvent(new Event("astro:page-load"));
            return previous.attributes;
        },
    };
}

test("article navigation follows the page wash throughout its return animation", () => {
    const f = fixture();
    f.scroll(200);
    f.animation(32, true);
    f.scroll(160);
    assert.equal(f.paint(), "-128px", "partly revealed paint follows the document coordinate");
    assert.equal(f.pendingFrames(), 1, "article pages without a profile keep sampling the return transform");
    f.animation(64, false);
    assert.equal(f.paint(), "-160px");
    assert.equal(f.pendingFrames(), 0, "sampling stops with the transform");
    f.scroll(100);
    assert.equal(f.paint(), "-100px");
});

function reveal(f) {
    f.scroll(700);
    f.scroll(636);
    assert.equal(f.hidden(), false);
}

test("returned pointer focus does not pin the bar after the dialog closes", () => {
    const f = fixture();
    reveal(f);
    f.input("pointerdown");
    f.dialog(true);
    f.scroll(900);
    assert.equal(f.hidden(), false, "open dialogs freeze navigation state");
    f.dialog(false);
    f.focus();
    assert.equal(f.hidden(), false, "focus restoration itself does not hide the trigger");
    f.scroll(980);
    assert.equal(f.hidden(), true, "reading downward after close retracts the bar");
    assert.equal(f.inert(), true);
    f.scroll(900);
    assert.equal(f.hidden(), false);
    assert.equal(f.inert(), false);
});

test("keyboard focus remains protected, including touch-to-keyboard and back", () => {
    const f = fixture();
    reveal(f);
    f.input("pointerdown");
    f.focus();
    f.input("keydown");
    f.scroll(800);
    assert.equal(f.hidden(), false, "keyboard navigation keeps focused controls visible");
    f.input("pointerdown");
    f.scroll(900);
    assert.equal(f.hidden(), true, "a subsequent touch pan releases the hold without manual blur");
});

test("wheel reading releases keyboard focus protection without a click", () => {
    const f = fixture();
    reveal(f);
    f.focus();
    f.input("keydown");
    f.scroll(800);
    assert.equal(f.hidden(), false, "keyboard focus still protects navigation before wheel input");
    f.input("wheel");
    f.scroll(900);
    assert.equal(f.hidden(), true, "wheel reading releases the hold without pointerdown or blur");
    f.scroll(820);
    assert.equal(f.hidden(), false);
});

test("repeated focus returns and page swaps leave direction tracking usable", () => {
    const f = fixture();
    for (let i = 0; i < 3; i++) {
        reveal(f);
        f.input("pointerdown");
        f.focus();
        f.scroll(800);
        assert.equal(f.hidden(), true);
    }
    const oldAttributes = f.swap();
    const before = [...oldAttributes];
    f.scroll(736);
    assert.equal(f.hidden(), false);
    f.scroll(820);
    assert.equal(f.hidden(), true);
    assert.deepEqual([...oldAttributes], before, "detached navigation is no longer updated");
    f.scroll(0);
    assert.equal(f.hidden(), false);
    assert.equal(f.inert(), false);
});
