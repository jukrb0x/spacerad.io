/// <reference path="../.astro/types.d.ts" />

// Cloudflare KV binding
interface Env {
    LIKES: KVNamespace;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {}
}

// Global Env variables
interface ImportMetaEnv {
    readonly PUBLIC_CUSDIS_APP_ID: string;
    readonly PUBLIC_COMMENT_SYSTEM: "cusdis" | "remark42";
    readonly PUBLIC_CUSDIS_HOST: string;
    readonly PUBLIC_REMARK_URL: string;
    readonly PUBLIC_REMARK_SITE_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
