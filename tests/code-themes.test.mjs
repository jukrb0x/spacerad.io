import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { pathToFileURL } from "node:url";
import { codeDark, codeLight } from "../scripts/code-themes.mjs";

// Test the highlighter owned by the installed rehype-pretty-code integration.
const require = createRequire(import.meta.resolve("rehype-pretty-code"));
const { createHighlighter } = await import(pathToFileURL(require.resolve("shiki")).href);
let highlighter;
before(async () => {
    highlighter = await createHighlighter({ themes: [codeLight, codeDark], langs: ["diff", "markdown", "cpp"] });
});
after(() => highlighter?.dispose());

for (const theme of ["radio-light", "radio-dark"]) {
    test(`${theme} preserves diff insert/delete/header distinctions`, () => {
        const { tokens } = highlighter.codeToTokens("@@ -1 +1 @@\n-old\n+new", { lang: "diff", theme });
        assert.equal(new Set(tokens.map((line) => line[0].color)).size, 3);
    });
    test(`${theme} preserves Markdown emphasis and raw-code styling`, () => {
        const { tokens } = highlighter.codeToTokens("# Heading\n~~deleted~~ and **bold** and *italic* and `raw`", { lang: "markdown", theme });
        const all = tokens.flat();
        const token = (word) => all.find((item) => item.content.includes(word));
        assert.ok(token("Heading").fontStyle & 2, "headings stay bold");
        assert.ok(token("deleted").fontStyle & 8, "strikethrough stays visible");
        assert.ok(token("bold").fontStyle & 2);
        assert.ok(token("italic").fontStyle & 1);
        assert.notEqual(token("raw").color, token(" and ").color);
    });
}
