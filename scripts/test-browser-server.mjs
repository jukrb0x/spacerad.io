import { dev } from "astro";
import { channelFixturePlugin } from "../tests/helpers/channel-fixture.mjs";

// Use a file entry point so Node's --input-type flag is never inherited by workers.
await dev({
    server: { host: "127.0.0.1", port: 4321 },
    integrations: [
        {
            name: "browser-reading-fixture",
            hooks: {
                "astro:config:setup": ({ injectRoute }) => {
                    injectRoute({ pattern: "/__test/reading/[kind]", entrypoint: "./tests/fixtures/reading.astro" });
                },
            },
        },
    ],
    vite: { server: { strictPort: true }, plugins: [channelFixturePlugin()] },
});
