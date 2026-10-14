import assert from "node:assert/strict";
import test from "node:test";
import { autoInit } from "../src/utils/spaLifecycle.ts";

// Model the lifecycle dispatched by ClientRouter, including its initial page-load.
for (const readyState of ["loading", "complete"]) {
    test(`page-load initializes once and once per navigation (${readyState})`, () => {
        const document = Object.assign(new EventTarget(), { readyState });
        globalThis.document = document;
        let calls = 0;
        autoInit(() => calls++, "page-load");
        document.dispatchEvent(new Event("DOMContentLoaded"));
        document.dispatchEvent(new Event("astro:page-load"));
        assert.equal(calls, 1, "initial document must not initialize twice");
        for (let navigation = 0; navigation < 3; navigation++) {
            document.dispatchEvent(new Event("astro:after-swap"));
            document.dispatchEvent(new Event("astro:page-load"));
        }
        assert.equal(calls, 4, "each navigation initializes exactly once");
        delete globalThis.document;
    });
}

test("after-swap still initializes the first document and subsequent swaps", () => {
    const document = Object.assign(new EventTarget(), { readyState: "loading" });
    globalThis.document = document;
    let calls = 0;
    autoInit(() => calls++);
    assert.equal(calls, 0);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    document.dispatchEvent(new Event("astro:page-load"));
    assert.equal(calls, 1);
    document.dispatchEvent(new Event("astro:after-swap"));
    assert.equal(calls, 2);
    delete globalThis.document;
});
