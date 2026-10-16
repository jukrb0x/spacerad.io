// The pinned package has no bundled types. Declare the options used here without
// adding a dependency or changing the lockfile for this boundary fix.
declare module "sanitize-html" {
    interface Options {
        allowedTags: string[];
        allowedAttributes: Record<string, string[]>;
        allowedSchemes: string[];
        allowedSchemesByTag: Record<string, string[]>;
        allowProtocolRelative: boolean;
    }
    export default function sanitizeHtml(html: string, options: Options): string;
}
