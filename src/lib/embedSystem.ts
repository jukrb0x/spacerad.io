/**
 * Embed System - Generic abstraction for third-party embed widgets
 * Handles script loading, theme synchronization, and lifecycle management
 */

import { getThemeState, onThemeChange, type ThemeState } from "./theme-effects";

export interface EmbedSystemConfig<TConfig = unknown> {
	/** URL of the embed script */
	scriptUrl: string;
	/** Data attribute to mark the script tag (e.g., "data-cusdis") */
	scriptAttr: string;
	/** CSS selector for container elements */
	containerSelector: string;
	/** Create embed configuration from container element and theme */
	createConfig: (container: HTMLElement, theme: ThemeState) => TConfig;
	/** Initialize the embed with the given configuration */
	initialize: (config: TConfig) => void;
	/** Optional: Update theme dynamically after initialization */
	updateTheme?: (theme: ThemeState) => void;
	/** Optional: Cleanup before re-initialization */
	cleanup?: () => void;
}

export class EmbedSystem<TConfig = unknown> {
	private themeUnsubscribe: (() => void) | null = null;

	constructor(private config: EmbedSystemConfig<TConfig>) {}

	/**
	 * Ensure the embed script is loaded
	 */
	private ensureScript(): HTMLScriptElement {
		let script = document.querySelector<HTMLScriptElement>(`script[${this.config.scriptAttr}]`);

		if (!script) {
			script = document.createElement("script");
			script.src = this.config.scriptUrl;
			script.async = true;
			script.setAttribute(this.config.scriptAttr, "true");
			document.head.appendChild(script);
		}

		return script;
	}

	/**
	 * Initialize a single container
	 */
	private initContainer(container: HTMLElement): void {
		// Run cleanup if provided
		if (this.config.cleanup) {
			this.config.cleanup();
		}

		// Get current theme state
		const themeState = getThemeState();

		// Create configuration
		const embedConfig = this.config.createConfig(container, themeState);

		// Clean up previous theme listener
		if (this.themeUnsubscribe) {
			this.themeUnsubscribe();
			this.themeUnsubscribe = null;
		}

		// Set up theme synchronization
		if (this.config.updateTheme) {
			this.themeUnsubscribe = onThemeChange((state) => {
				this.config.updateTheme?.(state);
			});
		}

		// Ensure script is loaded
		const script = this.ensureScript();

		// Initialize the embed
		const initializeEmbed = () => {
			this.config.initialize(embedConfig);
		};

		// Check if script is already loaded
		if (script.getAttribute(this.config.scriptAttr) === "loaded") {
			initializeEmbed();
		} else {
			script.addEventListener("load", () => {
				script.setAttribute(this.config.scriptAttr, "loaded");
				initializeEmbed();
			}, { once: true });
		}
	}

	/**
	 * Initialize all containers on the page
	 */
	private initAllContainers(): void {
		const containers = Array.from(
			document.querySelectorAll<HTMLElement>(this.config.containerSelector),
		);
		containers.forEach((container) => {
			this.initContainer(container);
		});
	}

	/**
	 * Initialize the embed system
	 * Call this from your script's entry point
	 */
	public init(): void {
		this.initAllContainers();
	}
}

/**
 * Factory function to create an embed system
 */
export function createEmbedSystem<TConfig>(
	config: EmbedSystemConfig<TConfig>,
): EmbedSystem<TConfig> {
	return new EmbedSystem(config);
}
