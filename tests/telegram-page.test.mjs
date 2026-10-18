import assert from "node:assert/strict";
import test from "node:test";
import { assertTelegramPage } from "../src/utils/telegram-page.ts";

test("observed channel title structure permits a legitimate empty channel or pagination end", () => {
    assert.doesNotThrow(() => assertTelegramPage("Fixture Radio", [], "SpaceRad_io"));
    assert.doesNotThrow(() => assertTelegramPage("Fixture Radio", ["SpaceRad_io/42"], "SpaceRad_io"));
});

test("missing channel identity or malformed existing message envelopes are parse failures", () => {
    for (const [title, ids] of [
        ["", []],
        ["  ", []],
        ["Radio", [undefined]],
        ["Radio", ["other/42"]],
        ["Radio", ["SpaceRad_io/no-id"]],
    ]) {
        assert.throws(() => assertTelegramPage(title, ids, "SpaceRad_io"), /Invalid Telegram/);
    }
});
