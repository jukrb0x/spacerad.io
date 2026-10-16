// Grammar-scoped light/dark palettes for fenced code. No client-side retokenization.
function theme(name, type, p) {
    return {
        name,
        type,
        colors: { "editor.foreground": p.ink, "editor.background": p.paper },
        settings: [
            { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: p.comment, fontStyle: "italic" } },
            { scope: ["keyword", "storage.modifier", "storage.type.function"], settings: { foreground: p.keyword } },
            { scope: ["string", "constant.other.symbol"], settings: { foreground: p.string } },
            { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: p.number } },
            { scope: ["entity.name.function", "support.function"], settings: { foreground: p.function } },
            {
                scope: [
                    "storage.type",
                    "support.type",
                    "support.class",
                    "entity.name.type",
                    "entity.name.class",
                    "entity.name.namespace",
                    "entity.name.scope-resolution",
                ],
                settings: { foreground: p.type },
            },
            { scope: ["variable.parameter"], settings: { foreground: p.ink } },
            { scope: ["entity.name.tag"], settings: { foreground: p.keyword } },
            { scope: ["entity.other.attribute-name"], settings: { foreground: p.type } },
            {
                scope: ["punctuation.definition.link", "punctuation.definition.string", "punctuation.definition.metadata"],
                settings: { foreground: p.keyword },
            },
            { scope: ["string.other.link.title", "string.other.link.description"], settings: { foreground: p.function } },
            { scope: ["markup.underline.link"], settings: { foreground: p.string, fontStyle: "underline" } },
            { scope: ["markup.bold"], settings: { foreground: p.keyword, fontStyle: "bold" } },
            { scope: ["markup.italic"], settings: { fontStyle: "italic" } },
            // Keep Markdown/diff semantics and less common grammar categories visible.
            { scope: ["markup.heading"], settings: { foreground: p.function, fontStyle: "bold" } },
            {
                scope: ["markup.quote", "markup.inserted", "punctuation.definition.inserted", "meta.diff.header.to-file"],
                settings: { foreground: p.string },
            },
            { scope: ["markup.deleted", "punctuation.definition.deleted", "meta.diff.header.from-file"], settings: { foreground: p.keyword } },
            {
                scope: ["markup.changed", "punctuation.definition.changed", "punctuation.definition.list.begin.markdown"],
                settings: { foreground: p.number },
            },
            { scope: ["meta.diff.range", "meta.diff.header", "meta.separator"], settings: { foreground: p.function, fontStyle: "bold" } },
            { scope: ["markup.inline.raw", "markup.raw"], settings: { foreground: p.type } },
            { scope: ["markup.strikethrough"], settings: { fontStyle: "strikethrough" } },
            { scope: ["markup.underline"], settings: { fontStyle: "underline" } },
            {
                scope: ["constant.other", "variable.language", "support.constant", "support.variable", "entity.name.constant"],
                settings: { foreground: p.number },
            },
            { scope: ["meta.property-name", "support.type.property-name", "variable.other.property"], settings: { foreground: p.type } },
            { scope: ["invalid", "message.error"], settings: { foreground: p.keyword, fontStyle: "underline" } },
        ],
    };
}
export const codeLight = theme("radio-light", "light", {
    ink: "#28323e",
    paper: "#f5f7f9",
    comment: "#596777",
    keyword: "#a42670",
    type: "#006b70",
    function: "#2455ad",
    string: "#246a36",
    number: "#9b4808",
});
export const codeDark = theme("radio-dark", "dark", {
    ink: "#e1e6ee",
    paper: "#1b1e22",
    comment: "#a5b1c1",
    keyword: "#ed9acb",
    type: "#72d2c5",
    function: "#8ebaff",
    string: "#a1d58b",
    number: "#efb47b",
});
