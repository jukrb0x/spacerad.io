import { dev } from "astro";

// Use a file entry point so Node's --input-type flag is never inherited by workers.
await dev({ server: { host: "127.0.0.1", port: 4321 }, vite: { server: { strictPort: true } } });
