import assert from "node:assert/strict";
import test from "node:test";
import { getPostTranslation } from "../src/utils/postTranslations.ts";

test("translation lookup requires both verified entries, never infers from a suffix", () => {
    const original = { id: "ue5-landscape-grass", data: { lang: "zh" } };
    const translated = { id: "ue5-landscape-grass-en", data: { lang: "en" } };
    assert.equal(getPostTranslation(original.id, [original, translated]), translated);
    assert.equal(getPostTranslation(translated.id, [original, translated]), original);
    assert.equal(getPostTranslation(original.id, [original]), undefined);
    assert.equal(getPostTranslation("xcode", [{ id: "xcode-en" }]), undefined);
});
