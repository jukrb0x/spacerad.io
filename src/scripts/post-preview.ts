import { getImageState, preloadImage } from "../utils/imagePreloader";

interface PostMeta {
    title: string;
    description: string;
    image?: string;
    lang?: "en" | "zh";
    tags?: string[];
}
type PostMetaMap = Record<string, PostMeta>;

function postId(link: HTMLAnchorElement): string | null {
    const url = new URL(link.href, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/posts/")
        ? link.dataset.postId || url.pathname.slice(7).replace(/\/$/, "")
        : null;
}

class PreviewCard {
    private card: HTMLElement | undefined;
    private target: HTMLAnchorElement | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private frame: number | undefined;
    private x = 0;
    private y = 0;
    private revision = 0;
    private pointerActive = false;
    private metaMap: PostMetaMap;

    constructor(metaMap: PostMetaMap) {
        this.metaMap = metaMap;
    }

    private ensureCard(): HTMLElement {
        if (this.card) return this.card;
        const card = document.createElement("div");
        card.className = "post-preview-card";
        card.id = "post-preview-tooltip";
        card.setAttribute("role", "tooltip");
        card.setAttribute("aria-hidden", "true");
        card.innerHTML = `<div class="post-preview-card__content"><h4 class="post-preview-card__title"></h4><div class="post-preview-card__image-container" hidden><img class="post-preview-card__image" alt="" width="560" height="280" decoding="async" /></div><p class="post-preview-card__desc"></p><ul class="post-preview-card__tags" hidden></ul></div>`;
        document.body.appendChild(card);
        this.card = card;
        return card;
    }

    private position = (): void => {
        this.frame = undefined;
        if (!this.card?.classList.contains("visible")) return;
        const { width, height } = this.card.getBoundingClientRect();
        let x = this.x + 16;
        if (x + width > window.innerWidth - 12) x = this.x - width - 16;
        x = Math.max(12, Math.min(x, window.innerWidth - width - 12));
        const y = Math.max(12, Math.min(this.y - height / 2, window.innerHeight - height - 12));
        this.card.style.transform = `translate(${x}px, ${y}px)`;
    };

    private fit(meta: PostMeta): void {
        const card = this.card;
        if (!card) return;
        const content = card.querySelector<HTMLElement>(".post-preview-card__content");
        const title = card.querySelector<HTMLElement>(".post-preview-card__title");
        const description = card.querySelector<HTMLElement>(".post-preview-card__desc");
        const image = card.querySelector<HTMLElement>(".post-preview-card__image-container");
        const list = card.querySelector<HTMLElement>(".post-preview-card__tags");
        if (!content || !title || !description || !image || !list) return;
        title.style.webkitLineClamp = "2";
        description.style.webkitLineClamp = "3";
        description.hidden = false;
        image.hidden = !meta.image || getImageState(new URL(meta.image, window.location.origin).href) === "error";
        const tags = meta.tags || [];
        list.classList.remove("post-preview-card__tags--visually-hidden");
        list.hidden = tags.length === 0;
        list.setAttribute("aria-label", tags.length ? `Tags: ${tags.join(", ")}` : "Tags");
        const items = tags.map((tag) => {
            const item = document.createElement("li");
            item.textContent = `#${tag}`;
            item.setAttribute("aria-hidden", "true");
            return item;
        });
        const trimTags = (rows: number): void => {
            list.replaceChildren(...items);
            if (!items.length) return;
            const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
            const height = items[0].getBoundingClientRect().height * rows + gap * (rows - 1);
            const more = document.createElement("li");
            more.setAttribute("aria-hidden", "true");
            let count = items.length;
            // Fit the remainder as a whole capsule; never clip a partially visible row.
            while (list.getBoundingClientRect().height > height + 0.5 && count > 0) {
                items[--count].remove();
                more.textContent = `+${items.length - count}`;
                list.append(more);
            }
        };
        trimTags(2);
        const fits = (): boolean => content.scrollHeight + 2 <= window.innerHeight - 24;
        // The noninteractive card cannot scroll. Sacrifice decorative/detail content
        // before allowing the viewport's max-height to cut through a capsule.
        if (!fits()) image.hidden = true;
        if (!fits()) trimTags(1);
        for (const lines of [2, 1]) {
            if (!fits()) description.style.webkitLineClamp = String(lines);
        }
        if (!fits()) description.hidden = true;
        if (!fits()) title.style.webkitLineClamp = "1";
        // Keep full tag names in the tooltip's accessible description even when
        // the viewport cannot accommodate a single visual row.
        if (!fits()) list.classList.add("post-preview-card__tags--visually-hidden");
    }

    private show(meta: PostMeta): void {
        const card = this.ensureCard();
        const revision = ++this.revision;
        const title = card.querySelector<HTMLElement>(".post-preview-card__title");
        const description = card.querySelector<HTMLElement>(".post-preview-card__desc");
        const container = card.querySelector<HTMLElement>(".post-preview-card__image-container");
        const image = card.querySelector<HTMLImageElement>("img");
        if (!title || !description || !container || !image) return;
        card.lang = meta.lang === "zh" ? "zh-CN" : "en";
        title.textContent = meta.title;
        description.textContent = meta.description;
        container.hidden = !meta.image;
        image.classList.remove("loaded");
        image.removeAttribute("src");
        if (meta.image) {
            const src = meta.image;
            const url = new URL(src, window.location.origin).href;
            preloadImage(url).then(() => {
                if (this.revision !== revision || !this.target) return;
                if (getImageState(url) !== "loaded") {
                    container.hidden = true;
                    this.fit(meta);
                    this.position();
                    return;
                }
                image.src = src;
                image.classList.add("loaded");
                this.fit(meta);
                this.position();
            });
        }
        this.fit(meta);
        card.classList.add("visible");
        card.setAttribute("aria-hidden", "false");
        this.target?.setAttribute("aria-describedby", [this.target.getAttribute("aria-describedby"), card.id].filter(Boolean).join(" "));
        this.position();
        document.fonts.ready.then(() => {
            if (this.revision !== revision || !this.target) return;
            this.fit(meta);
            this.position();
        });
    }

    hide = (): void => {
        clearTimeout(this.timer);
        if (this.frame !== undefined) cancelAnimationFrame(this.frame);
        this.frame = undefined;
        this.revision++;
        if (this.target) {
            const ids = (this.target.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== "post-preview-tooltip");
            if (ids.length) this.target.setAttribute("aria-describedby", ids.join(" "));
            else this.target.removeAttribute("aria-describedby");
        }
        this.target = undefined;
        this.pointerActive = false;
        this.card?.classList.remove("visible");
        this.card?.setAttribute("aria-hidden", "true");
    };

    private queue(target: HTMLAnchorElement): void {
        this.hide();
        const id = postId(target);
        if (!id || !this.metaMap[id]) return;
        this.target = target;
        this.timer = setTimeout(() => {
            if (this.target === target) this.show(this.metaMap[id]);
        }, 300);
    }

    private within(rect: DOMRect, x: number, y: number): boolean {
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    private withinPreview(x: number, y: number): boolean {
        if (!this.target || !this.card?.classList.contains("visible")) return false;
        const target = this.target.getBoundingClientRect();
        const card = this.card.getBoundingClientRect();
        if (this.within(target, x, y) || this.within(card, x, y)) return true;
        // Keep the horizontal gap traversable without intercepting anything underneath.
        return (
            x >= Math.min(target.right, card.right) &&
            x <= Math.max(target.left, card.left) &&
            y >= Math.min(target.top, card.top) &&
            y <= Math.max(target.bottom, card.bottom)
        );
    }

    enter = (event: MouseEvent): void => {
        if (this.withinPreview(event.clientX, event.clientY)) return;
        this.x = event.clientX;
        this.y = event.clientY;
        this.queue(event.currentTarget as HTMLAnchorElement);
        this.pointerActive = !!this.target;
    };
    move = (event: MouseEvent): void => {
        if (!this.target || !this.pointerActive) return;
        if (!this.within(this.target.getBoundingClientRect(), event.clientX, event.clientY)) {
            if (!this.withinPreview(event.clientX, event.clientY)) this.hide();
            // Freeze outside the title so the pointer can inspect the card.
            if (this.frame !== undefined) cancelAnimationFrame(this.frame);
            this.frame = undefined;
            return;
        }
        this.x = event.clientX;
        this.y = event.clientY;
        if (this.card?.classList.contains("visible") && this.frame === undefined) {
            this.frame = requestAnimationFrame(this.position);
        }
    };
    leaveWindow = (): void => {
        if (this.pointerActive) this.hide();
    };
    focus = (event: FocusEvent): void => {
        const target = event.currentTarget as HTMLAnchorElement;
        // Pointer clicks should never reopen a dismissed preview.
        if (!target.matches(":focus-visible")) return;
        const rect = target.getBoundingClientRect();
        this.x = rect.right;
        this.y = rect.top + rect.height / 2;
        this.queue(target);
    };
    keydown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") this.hide();
    };
    destroy = (): void => {
        this.hide();
        this.card?.remove();
    };
}

let dispose: (() => void) | undefined;
export function destroyPostPreview(): void {
    dispose?.();
    dispose = undefined;
}

export function initPostPreview(root: ParentNode = document): void {
    destroyPostPreview();
    // Only mouse activation requires a fine hover pointer; keyboards work on touch devices.
    const mouseEnabled = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const json = document.getElementById("all-posts-meta")?.textContent;
    if (!json) return;
    let metadata: PostMetaMap;
    try {
        metadata = JSON.parse(json);
    } catch {
        return;
    }
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).filter((link) => {
        if (link.closest("[data-no-preview], .toc") || link.dataset.preview === "off" || link.getAttribute("aria-hidden") === "true") return false;
        const id = postId(link);
        return !!id && !!metadata[id];
    });
    const preview = new PreviewCard(metadata);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    for (const link of links) {
        if (mouseEnabled) {
            link.addEventListener("mouseenter", preview.enter, options);
            link.addEventListener("mouseleave", preview.move, options);
        }
        link.addEventListener("focus", preview.focus, options);
        link.addEventListener("blur", preview.hide, options);
        link.addEventListener("click", preview.hide, options);
    }
    if (mouseEnabled) {
        document.addEventListener("mousemove", preview.move, options);
        document.addEventListener("mouseleave", preview.leaveWindow, options);
    }
    window.addEventListener("scroll", preview.hide, { ...options, passive: true, capture: true });
    window.addEventListener("resize", preview.hide, options);
    document.addEventListener("keydown", preview.keydown, options);
    dispose = () => {
        controller.abort();
        preview.destroy();
    };
}
