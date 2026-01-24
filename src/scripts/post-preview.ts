/**
 * Post Preview Card - Hover preview for blog post links
 *
 * Features:
 * - Smart positioning that follows cursor and stays within viewport
 * - Image preloading with state tracking (prevents duplicate requests)
 * - Smooth enter/exit animations with CSS transforms
 * - Respects reduced motion preferences
 * - Skips touch devices and small viewports
 */

interface PostMeta {
    title: string;
    description: string;
    image?: string;
}

type PostMetaMap = Record<string, PostMeta>;

type ImageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

// Image cache: tracks load state to prevent duplicate requests
const imageCache = new Map<string, ImageLoadState>();

// Preload an image and update cache state
function preloadImage(src: string): Promise<void> {
    const state = imageCache.get(src);

    // Already loaded or loading
    if (state === 'loaded') return Promise.resolve();
    if (state === 'loading') {
        return new Promise((resolve) => {
            const check = () => {
                const s = imageCache.get(src);
                if (s === 'loaded' || s === 'error') resolve();
                else requestAnimationFrame(check);
            };
            check();
        });
    }

    // Start loading
    imageCache.set(src, 'loading');

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(src, 'loaded');
            resolve();
        };
        img.onerror = () => {
            imageCache.set(src, 'error');
            resolve();
        };
        img.src = src;
    });
}

function getAbsoluteUrl(src: string): string {
    try {
        return new URL(src, window.location.origin).href;
    } catch {
        return src;
    }
}

function parsePostIdFromHref(href: string): string | null {
    try {
        const url = new URL(href, window.location.origin);
        // Remove leading slashes and "posts/" prefix
        return url.pathname.replace(/^\/+posts\//, '').replace(/^\/+/, '');
    } catch {
        return null;
    }
}

class PreviewCard {
    private card: HTMLElement | null = null;
    private imageEl: HTMLImageElement | null = null;
    private placeholderEl: HTMLElement | null = null;
    private titleEl: HTMLElement | null = null;
    private descEl: HTMLElement | null = null;

    private hoverTimeout: number | null = null;
    private currentTarget: HTMLElement | null = null;
    private isVisible = false;
    private mouseX = 0;
    private mouseY = 0;
    private rafId: number | null = null;

    private readonly HOVER_DELAY = 400;
    private readonly CARD_WIDTH = 280;
    private readonly CARD_OFFSET = 16;

    constructor(private metaMap: PostMetaMap) {}

    private createCard(): HTMLElement {
        const card = document.createElement('div');
        card.className = 'post-preview-card';
        card.setAttribute('role', 'tooltip');
        card.innerHTML = `
            <div class="post-preview-card__image-container">
                <img class="post-preview-card__image" alt="" />
                <div class="post-preview-card__placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21,15 16,10 5,21"/>
                    </svg>
                </div>
            </div>
            <div class="post-preview-card__content">
                <h4 class="post-preview-card__title"></h4>
                <p class="post-preview-card__desc"></p>
            </div>
        `;

        document.body.appendChild(card);

        this.imageEl = card.querySelector('.post-preview-card__image');
        this.placeholderEl = card.querySelector('.post-preview-card__placeholder');
        this.titleEl = card.querySelector('.post-preview-card__title');
        this.descEl = card.querySelector('.post-preview-card__desc');

        return card;
    }

    private ensureCard(): HTMLElement {
        if (!this.card) {
            this.card = this.createCard();
        }
        return this.card;
    }

    private updateContent(meta: PostMeta): void {
        if (!this.titleEl || !this.descEl || !this.imageEl || !this.placeholderEl) return;

        this.titleEl.textContent = meta.title || '';
        this.descEl.textContent = meta.description || '';

        if (meta.image) {
            const absoluteSrc = getAbsoluteUrl(meta.image);
            const state = imageCache.get(absoluteSrc);

            if (state === 'loaded') {
                // Image already cached - show immediately
                this.imageEl.src = meta.image;
                this.imageEl.alt = `Preview: ${meta.title}`;
                this.imageEl.classList.add('loaded');
                this.placeholderEl.classList.remove('visible');
            } else if (state === 'error') {
                // Failed to load - show placeholder
                this.imageEl.classList.remove('loaded');
                this.placeholderEl.classList.add('visible');
            } else {
                // Loading or not started - show placeholder, then image when ready
                this.imageEl.classList.remove('loaded');
                this.placeholderEl.classList.add('visible');

                preloadImage(absoluteSrc).then(() => {
                    // Check if still showing same post
                    if (imageCache.get(absoluteSrc) === 'loaded' && this.imageEl && this.placeholderEl && meta.image) {
                        this.imageEl.src = meta.image;
                        this.imageEl.alt = `Preview: ${meta.title}`;
                        this.imageEl.classList.add('loaded');
                        this.placeholderEl.classList.remove('visible');
                    }
                });
            }
        } else {
            // No image
            this.imageEl.classList.remove('loaded');
            this.placeholderEl.classList.add('visible');
        }
    }

    private updatePosition(): void {
        if (!this.card || !this.isVisible) return;

        const cardHeight = this.card.offsetHeight || 240;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Position to the right of cursor by default
        let x = this.mouseX + this.CARD_OFFSET;
        let y = this.mouseY - cardHeight / 2;

        // Flip to left if would overflow right edge
        if (x + this.CARD_WIDTH > viewportWidth - 12) {
            x = this.mouseX - this.CARD_WIDTH - this.CARD_OFFSET;
        }

        // Clamp to left edge
        if (x < 12) {
            x = 12;
        }

        // Clamp vertical position
        if (y < 12) {
            y = 12;
        }
        if (y + cardHeight > viewportHeight - 12) {
            y = viewportHeight - cardHeight - 12;
        }

        this.card.style.transform = `translate(${x}px, ${y}px)`;
    }

    private startPositionLoop(): void {
        if (this.rafId !== null) return;

        const loop = () => {
            this.updatePosition();
            if (this.isVisible) {
                this.rafId = requestAnimationFrame(loop);
            }
        };
        this.rafId = requestAnimationFrame(loop);
    }

    private stopPositionLoop(): void {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    private show(meta: PostMeta): void {
        const card = this.ensureCard();
        this.updateContent(meta);
        this.isVisible = true;

        // Force reflow before adding visible class
        card.offsetHeight;
        card.classList.add('visible');

        this.startPositionLoop();
    }

    private hide(): void {
        if (!this.card) return;

        this.isVisible = false;
        this.card.classList.remove('visible');
        this.stopPositionLoop();
    }

    private clearHoverTimeout(): void {
        if (this.hoverTimeout !== null) {
            window.clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
    }

    handleMouseEnter = (e: MouseEvent): void => {
        const target = e.currentTarget as HTMLAnchorElement;
        const id = target.dataset.postId || parsePostIdFromHref(target.href);
        if (!id || !this.metaMap[id]) return;

        this.currentTarget = target;
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;

        this.clearHoverTimeout();

        // Start preloading image immediately
        const meta = this.metaMap[id];
        if (meta.image) {
            preloadImage(getAbsoluteUrl(meta.image));
        }

        this.hoverTimeout = window.setTimeout(() => {
            if (this.currentTarget === target) {
                this.show(meta);
            }
        }, this.HOVER_DELAY);
    };

    handleMouseLeave = (): void => {
        this.clearHoverTimeout();
        this.currentTarget = null;
        this.hide();
    };

    handleMouseMove = (e: MouseEvent): void => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
    };

    handleFocus = (e: FocusEvent): void => {
        const target = e.currentTarget as HTMLAnchorElement;
        const id = target.dataset.postId || parsePostIdFromHref(target.href);
        if (!id || !this.metaMap[id]) return;

        this.currentTarget = target;

        // Position near the focused element
        const rect = target.getBoundingClientRect();
        this.mouseX = rect.right;
        this.mouseY = rect.top + rect.height / 2;

        this.clearHoverTimeout();
        this.hoverTimeout = window.setTimeout(() => {
            if (this.currentTarget === target) {
                this.show(this.metaMap[id]);
            }
        }, this.HOVER_DELAY);
    };

    handleBlur = (): void => {
        this.handleMouseLeave();
    };
}

export function initPostPreview(root: ParentNode = document): void {
    // Skip touch devices and small viewports
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const isSmall = window.matchMedia?.('(max-width: 1024px)').matches ?? false;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (isTouch || isSmall) return;

    // Get metadata from script tag
    const metaScript = document.getElementById('all-posts-meta');
    if (!metaScript?.textContent) return;

    let metaMap: PostMetaMap;
    try {
        metaMap = JSON.parse(metaScript.textContent) as PostMetaMap;
    } catch {
        return;
    }

    // Find eligible links
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a')).filter((link) => {
        if (!link.href) return false;

        // Exclude marked areas
        if (link.closest('[data-no-preview]')) return false;
        if (link.closest('.toc')) return false;
        if (link.dataset.preview === 'off') return false;

        // Exclude anchor links
        const rawHref = link.getAttribute('href') || '';
        if (rawHref.startsWith('#')) return false;

        // Check if it's a post link with metadata
        const id = link.dataset.postId || parsePostIdFromHref(link.href);
        return !!(id && metaMap[id]);
    });

    if (links.length === 0) return;

    // Add reduced motion class to body if needed
    if (prefersReducedMotion) {
        document.body.classList.add('reduced-motion');
    }

    const previewCard = new PreviewCard(metaMap);

    for (const link of links) {
        link.addEventListener('mouseenter', previewCard.handleMouseEnter);
        link.addEventListener('mouseleave', previewCard.handleMouseLeave);
        link.addEventListener('mousemove', previewCard.handleMouseMove);
        link.addEventListener('focus', previewCard.handleFocus);
        link.addEventListener('blur', previewCard.handleBlur);
    }
}
