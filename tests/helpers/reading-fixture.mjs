/** @returns {import("../../src/utils/posts").BlogPost[]} */
export function readingPosts(kind) {
    if (!["with-image", "without-image"].includes(kind)) throw new Error("Unknown reading fixture");
    return [
        { id: "fixture-draft", image: true, draft: true },
        { id: "fixture-lead", image: kind === "with-image" },
        { id: "fixture-image-one", image: true },
        { id: "fixture-text-one", image: false },
        { id: "fixture-image-two", image: true },
        { id: "fixture-text-two", image: false },
    ].map(({ id, image, draft = false }) => ({
        id,
        collection: "blog",
        body: "A reading layout fixture.",
        data: {
            title: id,
            description: "A reading layout fixture with a stable excerpt.",
            published: new Date("2026-01-01T00:00:00Z"),
            lang: kind === "with-image" ? "zh" : "en",
            tags: [],
            hidden: false,
            draft,
            comment: false,
            ...(image ? { socialImage: "/og-image.png" } : {}),
        },
    }));
}
