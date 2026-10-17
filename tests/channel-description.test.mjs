import assert from "node:assert/strict";
import test from "node:test";
import { formatChannelDescription } from "../src/utils/channelDescription.ts";

test("description modes preserve lines or explicitly collapse them", () => {
    const source = "FM 466.6\r\n\r\nWe Know Nothing. 🪐";
    assert.equal(formatChannelDescription(source, "first-line"), "FM 466.6");
    assert.equal(formatChannelDescription(source, "full"), "FM 466.6\n\nWe Know Nothing. 🪐");
    assert.equal(formatChannelDescription(source, "merged"), "FM 466.6 We Know Nothing. 🪐");
});

test("description modes handle empty lines, long text and literal markup", () => {
    assert.equal(formatChannelDescription("\nsecond", "first-line"), "");
    for (const mode of ["first-line", "full", "merged"]) {
        assert.equal(formatChannelDescription("", mode), "");
        const literal = `<script>alert("&")</script> ${"长".repeat(1000)}`;
        assert.equal(formatChannelDescription(literal, mode), literal);
    }
    assert.equal(formatChannelDescription("a\rb\r\rc", "full"), "a\nb\n\nc");
    assert.equal(formatChannelDescription("a  b\n \n c", "merged"), "a  b c");
});
