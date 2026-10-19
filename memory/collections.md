# Collections: templates and authored data

Beer Log is published at `/beer-collection` through `src/pages/beer-collection.astro`.
Its route loads content and sorts entries. Collections navigation is available in
production on desktop and mobile; the page heading is indexed by Pagefind.

## Files to edit

- `src/content/collections/pages/beer.yaml`: heading, personal subtitle, section
  labels and source disclosures, in English and Chinese.
- `src/content/collections/items/beer/*.md`: one beer per file. Add/remove a file
  to add/remove an entry. `order` controls display order; filename is stable ID.
- `src/components/collections/CollectionPage.astro`: shared grid, hover, details,
  mobile panel, theme and lifecycle behavior. No beer list is embedded here.
- `src/utils/collectionSchema.ts`: strict public content schemas.
- `src/content.config.ts`: Astro glob loaders for YAML pages and Markdown items.

Each entry has `collection`, `order`, `title`, optional `maker` and local `image`, optional
`imageFit`/`crop`, bilingual `imageLabel`, `facts`, `summary` and `sources`.
Facts are label/value pairs rather than beer-specific component props. Asset paths
resolve relative to the Markdown file. Use the neighbouring entry as an example.
Crop metadata only controls existing artwork framing; it does not generate art.

## Personal notes

The Markdown body after the closing `---` is an optional personal note. Only add
actual user-authored or user-approved notes. Set `noteLanguage: zh` or `en` to
identify the authored language. Notes are not auto-translated and are never
required. An empty body omits the entire notes section. Brewery summaries and
personal notes remain separate; don't present brewery copy as personal critique.

Do not import raw Notion records. Drinking dates, venues, coordinates and travel
history are excluded, including hidden frontend data. The strict schema rejects
unknown frontmatter keys; authors must also keep private information out of prose.

## Other collections

Add a YAML page record, a folder of Markdown entries with a matching `collection`
key, and a small route that loads those records and passes them to CollectionPage.
The template does not require ABV, brewery or beer style: supply appropriate facts
and section labels for coffee, games or photography. Only list usable routes in
`COLLECTION_LINKS`; do not add placeholder links. A future photographic gallery may
need a different image treatment while retaining the same content contract.

## Verification

`node --test tests/collection-content.test.mjs` validates current bilingual data,
local asset references, empty current personal notes and rejected private fields.
Browser checks cover desktop hover across the dropdown gap, Escape, touch,
preferred language persistence, translated details and SPA navigation.

On narrow screens the detail dialog rises from below the viewport. Closing it
reverses that same animation from its current position, including when dismissed
mid-entrance. Its backdrop tint follows the visible sheet height so Safari's
lower browser chrome matches the panel; reduced motion closes immediately.

The current data contains 11 Beer Log entries and Sangria de cava. Only the drink identity was extracted from the separate Sangria record; private receipt context is excluded. Missing verified artwork renders as an ordinary text tile, never a fabricated logo. Missing ABV is explicitly unconfirmed. Sources may be empty when only the private log supports the identity; private Notion URLs are not published. Brand artwork is distinct from a verified product tap badge.

Artwork follow-up: Flight Mode uses a round CSS crop of Big Smoke’s official tap photograph. Optional crop `height` preserves a non-square source aspect ratio; cropped images request enough source pixels for a legible badge. Stella, Estrella Galicia and Turia use fuller label artwork with attribution links. The Cow Pale Ale and Sangria remain text-only because no matching product mark is verified. Header tools are search, language, theme, with 44px hit targets and 4px gaps.
