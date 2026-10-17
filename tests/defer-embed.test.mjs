import assert from "node:assert/strict";
import test from "node:test";
import { deferEmbed } from "../src/utils/deferEmbed.ts";

function fixture() {
    const section = new EventTarget();
    const container = { isConnected: true, closest: () => section };
    let callback;
    let disconnected = 0;
    globalThis.IntersectionObserver = class {
        constructor(fn) {
            callback = fn;
        }
        observe(target) {
            assert.equal(target, section);
        }
        disconnect() {
            disconnected++;
        }
    };
    let starts = 0;
    const cancel = deferEmbed(container, () => starts++);
    return {
        section,
        container,
        cancel,
        intersect: (visible) => callback([{ isIntersecting: visible }]),
        get starts() {
            return starts;
        },
        get disconnected() {
            return disconnected;
        },
    };
}

test("offscreen startup stays deferred; visibility initializes once", () => {
    const f = fixture();
    assert.equal(f.starts, 0);
    f.intersect(false);
    assert.equal(f.starts, 0);
    f.intersect(true);
    f.intersect(true);
    f.section.dispatchEvent(new Event("focusin"));
    assert.equal(f.starts, 1);
    assert.equal(f.disconnected, 1);
});
for (const event of ["pointerdown", "focusin"]) {
    test(`${event} starts comments without waiting for the observer`, () => {
        const f = fixture();
        f.section.dispatchEvent(new Event(event));
        f.intersect(true);
        assert.equal(f.starts, 1);
    });
}

test("navigation cancels queued visibility callbacks and intent listeners", () => {
    const f = fixture();
    f.cancel();
    f.intersect(true);
    f.section.dispatchEvent(new Event("pointerdown"));
    f.section.dispatchEvent(new Event("focusin"));
    assert.equal(f.starts, 0);
});

test("detached roots never initialize", () => {
    const f = fixture();
    f.container.isConnected = false;
    f.intersect(true);
    assert.equal(f.starts, 0);
    f.cancel();
});

test("a new article has its own gate", () => {
    const old = fixture();
    old.cancel();
    const next = fixture();
    old.intersect(true);
    next.intersect(true);
    assert.equal(old.starts, 0);
    assert.equal(next.starts, 1);
});

test("missing IntersectionObserver preserves access to comments", () => {
    delete globalThis.IntersectionObserver;
    const container = Object.assign(new EventTarget(), { isConnected: true, closest: () => null });
    let starts = 0;
    const cancel = deferEmbed(container, () => starts++);
    assert.equal(starts, 1);
    container.dispatchEvent(new Event("pointerdown"));
    assert.equal(starts, 1);
    cancel();
});
