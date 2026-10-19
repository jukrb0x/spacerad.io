import assert from "node:assert/strict";
import test from "node:test";
import { resolveLanguage } from "../src/i18n/language.ts";
import { getHomePosts } from "../src/utils/postTranslations.ts";

test("explicit UI language wins; browser language ordering respects regional tags", () => {
    assert.equal(resolveLanguage("en", ["zh-CN"]), "en");
    assert.equal(resolveLanguage("zh", ["en-US"]), "zh");
    assert.equal(resolveLanguage(null, ["fr-FR", "zh-TW", "en"]), "zh");
    assert.equal(resolveLanguage("invalid", ["en-GB", "zh"]), "en");
    assert.equal(resolveLanguage(null, ["fr"]), "en");
});
test("home uses available real counterparts, preserving originals' positions and unpaired writing", () => {
    const original = { id: "ue5-landscape-grass", data: { lang: "zh" } };
    const english = { id: "ue5-landscape-grass-en", data: { lang: "en" } };
    const unpaired = { id: "unpaired", data: { lang: "zh" } };
    const standalone = { id: "english-only", data: { lang: "en" } };
    assert.deepEqual(getHomePosts([english, unpaired, original, standalone], "en"), [unpaired, english, standalone]);
    assert.deepEqual(getHomePosts([english, unpaired, original, standalone], "zh"), [unpaired, original, standalone]);
    assert.deepEqual(getHomePosts([unpaired, original], "en"), [unpaired, original]);
    assert.deepEqual(getHomePosts([english], "zh"), [english]);
    assert.deepEqual(getHomePosts([original, { ...english, data: { lang: "en", draft: true } }], "en"), [original]);
});
