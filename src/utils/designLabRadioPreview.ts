import { icons } from "@iconify-json/ri";
import preview from "../assets/design-lab/radio-preview.json";

// The cached HTML needs the same library icon as the live Astro links.
const arrow = `<svg class="link-arrow" data-icon="ri:arrow-right-up-line" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons.icons["arrow-right-up-line"].body}</svg>`;
export const radioPreview = {
    ...preview,
    html: preview.html.replaceAll('<span aria-hidden="true">↗</span>', arrow),
};
