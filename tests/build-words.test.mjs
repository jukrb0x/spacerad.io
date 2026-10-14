import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/home/ProfileCard.astro", import.meta.url), "utf8");

function fixture({ count = 6, random = () => 0.5, reduced = false, animate = true } = {}) {
    const timers = new Map();
    const animations = new Set();
    let id = 0;
    const words = Array.from({ length: count }, (_, index) => {
        const attrs = new Set(index === 0 ? ["data-current"] : []);
        return {
            hasAttribute: (key) => attrs.has(key),
            setAttribute: (key) => attrs.add(key),
            removeAttribute: (key) => attrs.delete(key),
            animate() {
                let resolve;
                let reject;
                const animation = {
                    finished: new Promise((yes, no) => {
                        resolve = yes;
                        reject = no;
                    }),
                    finish: () => resolve(),
                    cancel() {
                        animations.delete(animation);
                        reject(new Error("cancelled"));
                    },
                };
                animations.add(animation);
                return animation;
            },
        };
    });
    const element = { animate, querySelectorAll: () => words };
    const document = Object.assign(new EventTarget(), {
        hidden: false,
        querySelector: () => element,
        currentScript: { previousElementSibling: { querySelectorAll: () => words } },
    });
    const motion = Object.assign(new EventTarget(), { matches: reduced });
    const math = Object.create(Math);
    math.random = random;
    const context = createContext({
        document,
        window: { matchMedia: () => motion },
        Math: math,
        AbortController,
        setTimeout: (fn, delay) => {
            assert.equal(delay, 4000);
            timers.set(++id, fn);
            return id;
        },
        clearTimeout: (key) => timers.delete(key),
    });
    const inline = source.match(/<script is:inline[^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (inline) runInContext(inline, context);
    const { outputText } = ts.transpileModule(source.match(/<script>([\s\S]*?)<\/script>/)[1], {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    runInContext(outputText, context);
    document.dispatchEvent(new Event("astro:page-load"));
    const current = () => words.findIndex((word) => word.hasAttribute("data-current"));
    return {
        document,
        motion,
        timers,
        animations,
        current,
        start() {
            assert.equal(timers.size, 1);
            const [key, fn] = [...timers][0];
            timers.delete(key);
            return fn();
        },
        async step() {
            const pending = this.start();
            [...animations].forEach((animation) => {
                animation.finish();
            });
            await pending;
            return current();
        },
        dispose: () => document.dispatchEvent(new Event("astro:before-swap")),
    };
}

// A fixed SSR opening must fail for controlled random samples, including both ends.
for (const [sample, expected] of [
    [0, 0],
    [0.5, 3],
    [0.999999, 5],
]) {
    test(`opening phrase is initialized synchronously for random sample ${sample}`, () => {
        const f = fixture({ random: () => sample });
        assert.equal(f.current(), expected);
        f.dispose();
    });
}

// Sequential order, omitted entries and a repeat at a round boundary must fail.
for (const count of [2, 6]) {
    test(`${count} phrases appear once per shuffled round without boundary repeats`, async () => {
        let sample = 0;
        const f = fixture({ count, random: () => [0.99, 0, 0.5, 0.25][sample++ % 4] });
        const rounds = [];
        for (let round = 0; round < 4; round++) {
            const values = [round === 0 ? f.current() : await f.step()];
            for (let i = 1; i < count; i++) values.push(await f.step());
            assert.deepEqual(
                [...values].sort((a, b) => a - b),
                Array.from({ length: count }, (_, i) => i),
            );
            if (round > 0) assert.notEqual(values[0], rounds.at(-1).at(-1));
            rounds.push(values);
        }
        if (count === 6) {
            assert.deepEqual(
                rounds.slice(0, 2),
                [
                    [5, 3, 1, 4, 2, 0],
                    [3, 5, 4, 1, 2, 0],
                ],
                "controlled samples shuffle within and between rounds",
            );
        }
        f.dispose();
    });
}

test("constant randomness still avoids repeats across a reshuffle boundary", async () => {
    const f = fixture({ random: () => 0 });
    const values = [f.current()];
    for (let i = 0; i < 23; i++) values.push(await f.step());
    for (let i = 1; i < values.length; i++) assert.notEqual(values[i], values[i - 1]);
    f.dispose();
});

test("cancelled exchanges do not consume an unseen phrase, including at a round boundary", async () => {
    const f = fixture();
    const first = f.current();
    const seen = [first];
    for (let i = 0; i < 6; i++) {
        const previous = f.current();
        const pending = f.start();
        f.document.hidden = true;
        f.document.dispatchEvent(new Event("visibilitychange"));
        await pending;
        assert.equal(f.current(), previous);
        assert.equal(f.timers.size, 0);
        assert.equal(f.animations.size, 0);
        f.document.hidden = false;
        f.document.dispatchEvent(new Event("visibilitychange"));
        seen.push(await f.step());
    }
    assert.equal(new Set(seen.slice(0, 6)).size, 6);
    assert.notEqual(seen[6], seen[5]);
    f.dispose();
    assert.equal(f.timers.size, 0);
});

for (const options of [{ count: 0 }, { count: 1 }, { reduced: true }, { animate: false }]) {
    test(`static edge case ${JSON.stringify(options)} creates no exchange timer`, () => {
        const f = fixture(options);
        assert.equal(f.timers.size, 0);
        assert.equal(f.animations.size, 0);
        assert.equal(f.current(), options.count === 0 ? -1 : options.count === 1 ? 0 : 3);
        f.dispose();
    });
}
