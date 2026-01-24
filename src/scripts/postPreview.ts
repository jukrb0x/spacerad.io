type PostMeta = {
    title: string;
    description: string;
    image?: string;
};

type PostMetaMap = Record<string, PostMeta>;

const CARD_ID = "post-preview-card";

function parsePostIdFromHref(href: string): string | null {
    try {
        const url = new URL(href, window.location.origin);
        return url.pathname.replace(/^\/+/, "");
    } catch {
        return null;
    }
}

function ensurePreviewCard(): HTMLElement {
    let card = document.getElementById(CARD_ID);
    if (card) return card;

    card = document.createElement("div");
    card.id = CARD_ID;
    card.className =
        "fixed z-[60] w-72 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg opacity-0 pointer-events-none transition-all duration-300 ease-out";
    card.style.transform = "translateY(-8px) scale(0.96)";

    card.innerHTML = `
		<div class="h-40 w-full bg-muted-bg relative overflow-hidden">
			<img id="${CARD_ID}-image" class="absolute top-0 left-0 w-full h-full object-cover" style="opacity: 0; transition: opacity 0.2s;" alt="" />
			<div id="${CARD_ID}-no-image" class="absolute top-0 left-0 w-full h-full flex items-center justify-center text-xs text-muted" style="opacity: 0; transition: opacity 0.2s;">
				No preview image
			</div>
		</div>
		<div class="space-y-2 p-4 text-sm">
			<h5 id="${CARD_ID}-title" class="font-semibold text-primary"></h5>
			<p id="${CARD_ID}-description" class="text-secondary"></p>
		</div>
	`;

    document.body.appendChild(card);
    return card;
}

// Track successfully loaded image URLs (stores absolute URLs for comparison)
const loadedImages = new Set<string>();

// Convert relative URL to absolute for consistent comparison
function toAbsoluteUrl(src: string): string {
    try {
        return new URL(src, window.location.origin).href;
    } catch {
        return src;
    }
}

function updatePreviewContent(card: HTMLElement, meta: PostMeta) {
    const imageEl = card.querySelector<HTMLImageElement>(`#${CARD_ID}-image`);
    const noImageEl = card.querySelector<HTMLDivElement>(`#${CARD_ID}-no-image`);
    const titleEl = card.querySelector<HTMLHeadingElement>(`#${CARD_ID}-title`);
    const descriptionEl = card.querySelector<HTMLParagraphElement>(`#${CARD_ID}-description`);

    if (titleEl) titleEl.textContent = meta.title ?? "";
    if (descriptionEl) descriptionEl.textContent = meta.description ?? "";

    if (meta.image && imageEl && noImageEl) {
        const imageSrc = meta.image;
        const absoluteSrc = toAbsoluteUrl(imageSrc);

        // Helper to show the image
        const showImage = () => {
            imageEl.style.opacity = "1";
            noImageEl.style.opacity = "0";
        };

        // Helper to show error/loading state
        const showMessage = (msg: string) => {
            imageEl.style.opacity = "0";
            noImageEl.style.opacity = "1";
            noImageEl.textContent = msg;
        };

        // Check if this exact image is already loaded in the element
        if (imageEl.src === absoluteSrc && imageEl.complete && imageEl.naturalWidth > 0) {
            showImage();
            return;
        }

        // Check if we've loaded this image before (will use browser cache)
        if (loadedImages.has(absoluteSrc)) {
            if (imageEl.src !== absoluteSrc) {
                imageEl.alt = `Preview of ${meta.title ?? ""}`;
                imageEl.src = imageSrc;
            }
            // Check if complete after setting src (sync from cache)
            if (imageEl.complete && imageEl.naturalWidth > 0) {
                showImage();
            } else {
                // Wait for load
                const onLoad = () => {
                    showImage();
                    imageEl.removeEventListener("load", onLoad);
                    imageEl.removeEventListener("error", onError);
                };
                const onError = () => {
                    showMessage("No preview image");
                    imageEl.removeEventListener("load", onLoad);
                    imageEl.removeEventListener("error", onError);
                };
                imageEl.addEventListener("load", onLoad);
                imageEl.addEventListener("error", onError);
            }
            return;
        }

        // First time loading - show loading state
        showMessage("Loading...");

        // Remove old listeners and add new ones
        const onLoad = () => {
            loadedImages.add(absoluteSrc);
            showImage();
            imageEl.removeEventListener("load", onLoad);
            imageEl.removeEventListener("error", onError);
        };
        const onError = () => {
            console.error("[PostPreview] Failed to load image:", imageSrc);
            showMessage("No preview image");
            imageEl.removeEventListener("load", onLoad);
            imageEl.removeEventListener("error", onError);
        };

        imageEl.addEventListener("load", onLoad);
        imageEl.addEventListener("error", onError);
        imageEl.alt = `Preview of ${meta.title ?? ""}`;
        imageEl.src = imageSrc;
    } else if (imageEl && noImageEl) {
        imageEl.style.opacity = "0";
        noImageEl.style.opacity = "1";
        noImageEl.textContent = "No preview image";
    }
}

function showCard(card: HTMLElement, event: MouseEvent | FocusEvent) {
    card.style.opacity = "1";
    card.style.visibility = "visible";
    card.style.pointerEvents = "auto";
    card.style.transform = "translateY(0) scale(1)";
    updatePosition(card, event);
}

function hideCard(card: HTMLElement) {
    card.style.opacity = "0";
    card.style.visibility = "hidden";
    card.style.pointerEvents = "none";
    card.style.transform = "translateY(-8px) scale(0.96)";
}

function updatePosition(card: HTMLElement, event: MouseEvent | FocusEvent) {
    if (!(event instanceof MouseEvent)) return;

    const cardWidth = 300;
    const cardHeight = card.offsetHeight || 250;
    const offset = 20;

    let x = event.clientX + offset;
    let y = event.clientY - cardHeight / 2;

    if (x + cardWidth > window.innerWidth) {
        x = event.clientX - cardWidth - offset;
    }

    if (y < 0) y = 10;

    if (y + cardHeight > window.innerHeight) {
        y = window.innerHeight - cardHeight - 10;
    }

    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
}

export function initPostPreview(root: ParentNode = document) {
    // Skip mobile/touch environments to avoid showing preview cards on small-screen devices
    // Coarse pointer typically indicates touch devices; also blocks smaller viewports
    const isCoarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const isSmallViewport = window.matchMedia?.("(max-width: 1024px)").matches ?? false;
    if (isCoarse || isSmallViewport) return;
    const metaScript = document.getElementById("all-posts-meta");
    if (!metaScript || !metaScript.textContent) return;

    let metaMap: PostMetaMap;
    try {
        metaMap = JSON.parse(metaScript.textContent) as PostMetaMap;
    } catch {
        return;
    }

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a")).filter((link) => {
        if (!link.href) return false;
        // Exclude table of contents and areas/links marked to disable previews
        if (link.closest("[data-no-preview]")) return false;
        if (link.closest(".toc")) return false;
        if (link.dataset.preview === "off") return false;
        // Exclude in-page anchors (such as TOC links)
        const rawHref = link.getAttribute("href") || "";
        if (rawHref.startsWith("#")) return false;
        const id = link.dataset.postId || parsePostIdFromHref(link.href);
        return !!(id && metaMap[id]);
    });

    if (links.length === 0) return;

    const previewCard = ensurePreviewCard();
    let hoverTimeout: number | null = null;

    const handleEnter = (event: Event) => {
        const target = event.currentTarget as HTMLAnchorElement;
        const id = target.dataset.postId || parsePostIdFromHref(target.href);
        if (!id || !metaMap[id]) return;

        if (hoverTimeout) window.clearTimeout(hoverTimeout);

        updatePreviewContent(previewCard, metaMap[id]);
        hoverTimeout = window.setTimeout(() => {
            showCard(previewCard, event as MouseEvent);
        }, 500);
    };

    const handleLeave = () => {
        if (hoverTimeout) {
            window.clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        hideCard(previewCard);
    };

    const handleMove = (event: MouseEvent) => {
        updatePosition(previewCard, event);
    };

    links.forEach((link) => {
        link.addEventListener("mouseenter", handleEnter);
        link.addEventListener("mouseleave", handleLeave);
        link.addEventListener("focus", handleEnter);
        link.addEventListener("blur", handleLeave);
        link.addEventListener("mousemove", handleMove);
    });
}
