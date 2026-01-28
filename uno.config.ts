import { defineConfig, presetWebFonts, transformerDirectives, transformerVariantGroup } from "unocss";
import presetWind3 from "@unocss/preset-wind3";

export default defineConfig({
    presets: [
        presetWind3(),
        presetWebFonts({
            fonts: {
                sans: "Inter:400,500,600,700",
                mono: "Fira Code:400,500",
            },
        }),
    ],
    transformers: [transformerDirectives(), transformerVariantGroup()],

    // Dark mode using data-theme attribute
    variants: [
        (matcher) => {
            if (!matcher.startsWith("dark:")) return matcher;
            return {
                matcher: matcher.slice(5),
                selector: (s) => `[data-theme="dark"] ${s}`,
            };
        },
    ],

    // Theme colors mapped to CSS variables
    theme: {
        colors: {
            // Background colors
            page: "var(--color-bg-page)",
            surface: "var(--color-bg-surface)",

            // Text colors
            primary: "var(--color-text-primary)",
            secondary: "var(--color-text-secondary)",
            muted: "var(--color-text-muted)",
            inverse: "var(--color-text-inverse)",

            // Accent colors
            accent: {
                DEFAULT: "var(--color-accent)",
                dark: "var(--color-accent-dark)",
                soft: "var(--color-accent-soft)",
                tint: "var(--color-accent-tint)",
                warm: "var(--color-accent-warm)",
                cool: "var(--color-accent-cool)",
            },

            // Link colors
            link: {
                DEFAULT: "var(--color-link)",
                hover: "var(--color-link-hover)",
            },

            // Border colors
            border: {
                DEFAULT: "var(--color-border)",
                soft: "var(--color-border-soft)",
                subtle: "var(--color-border-subtle)",
                strong: "var(--color-border-strong)",
            },

            // State colors
            success: "var(--color-success)",
            warning: "var(--color-warning)",
            danger: "var(--color-danger)",
            note: "var(--color-note)",

            // Space Radio color palettes
            radio: {
                dial: "var(--color-radio-dial)",
                tube: "var(--color-radio-tube)",
                grill: "var(--color-radio-grill)",
            },
            space: {
                cyan: "var(--color-space-cyan)",
                purple: "var(--color-space-purple)",
                blue: "var(--color-space-blue)",
                silver: "var(--color-space-silver)",
            },

            // Code
            "code-bg": "var(--color-code-bg)",
        },
        borderRadius: {
            sm: "var(--radius-sm)",
            md: "var(--radius-md)",
            lg: "var(--radius-lg)",
        },
        boxShadow: {
            xs: "var(--shadow-xs)",
            sm: "var(--shadow-sm)",
            md: "var(--shadow-md)",
            soft: "var(--shadow-soft)",
            strong: "var(--shadow-strong)",
            xl: "var(--shadow-xl)",
            "2xl": "var(--shadow-2xl)",
            lightbox: "var(--shadow-lightbox)",
            "button-hover": "var(--shadow-button-hover)",
            "glow-accent-soft": "var(--glow-accent-soft)",
            "glow-accent-strong": "var(--glow-accent-strong)",
            "glow-cool": "var(--glow-cool)",
        },
        zIndex: {
            base: "var(--z-base)",
            dropdown: "var(--z-dropdown)",
            sticky: "var(--z-sticky)",
            fixed: "var(--z-fixed)",
            "modal-backdrop": "var(--z-modal-backdrop)",
            modal: "var(--z-modal)",
            popover: "var(--z-popover)",
            tooltip: "var(--z-tooltip)",
        },
    },

    // Shortcuts for common patterns
    shortcuts: {
        // Focus states
        "focus-accent": "outline-none focus-visible:(outline-2 outline-accent-soft outline-offset-2)",

        // Transitions
        "transition-interactive": "transition-[color,background-color,border-color] duration-200 ease-out",
        "transition-fast": "transition-all duration-150 ease-out",
        "transition-base": "transition-all duration-200 ease-out",
        "transition-slow": "transition-all duration-300 ease-out",

        // Layout patterns - Space Radio
        "flex-center": "flex items-center justify-center",
        "flex-between": "flex items-center justify-between",
        "flex-col-center": "flex flex-col items-center justify-center",

        // Gradient text - Space Radio
        "text-gradient-warm-cool": "bg-clip-text text-transparent bg-gradient-to-r from-accent-warm to-accent-cool",
        "text-gradient-cosmic": "bg-clip-text text-transparent",

        // Interactive effects - Space Radio
        "hover-lift": "transition-transform duration-200 hover:(-translate-y-0.5)",
        "hover-glow": "transition-shadow duration-300 hover:shadow-glow-accent-soft",

        // Icon button
        "icon-btn": "inline-flex items-center justify-center bg-transparent text-secondary cursor-pointer transition-interactive hover:text-accent",
        "icon-btn-xs": "w-8 h-8",
        "icon-btn-sm": "w-10 h-10",
        "icon-btn-md": "w-12 h-12",
        "icon-btn-round": "rounded-full",
        "icon-btn-square": "rounded-md",
        "icon-btn-bordered": "border border-border-soft",

        // Surface card
        "surface-card": "bg-surface rounded-md border-none border-border-subtle shadow-soft",
        "surface-card-hover": "hover:(border-accent shadow-strong)",
        "card-interactive": "surface-card transition-all duration-200 hover:(border-accent shadow-soft -translate-y-0.5)",

        // Page shell (main container)
        "page-shell": "max-w-5xl mx-auto px-6 py-8 sm:px-6",
        "container-base": "max-w-[72rem] mx-auto px-4 sm:px-6",
        "section-padding": "py-12 sm:py-16 lg:py-20",
    },

    // Safe list for dynamic classes
    safelist: [
        "prose",
        "toc",
        "lightbox",
        "scroll-locked",
        // Custom utility classes from global.css
        "bg-muted",
        // Animation classes
        "animate-pop",
        "animate-shake",
    ],

    // Rules for custom utilities
    rules: [
        // Measure (max-width for reading)
        ["measure", { "max-width": "68ch" }],
        ["measure-wide", { "max-width": "72ch" }],

        // Font sizes from tokens
        ["text-xs", { "font-size": "var(--font-size-xs)" }],
        ["text-sm", { "font-size": "var(--font-size-sm)" }],
        ["text-base", { "font-size": "var(--font-size-base)" }],
        ["text-lg", { "font-size": "var(--font-size-lg)" }],
        ["text-xl", { "font-size": "var(--font-size-xl)" }],
        ["text-2xl", { "font-size": "var(--font-size-2xl)" }],
        ["text-3xl", { "font-size": "var(--font-size-3xl)" }],
        ["text-4xl", { "font-size": "var(--font-size-4xl)" }],
        ["text-5xl", { "font-size": "var(--font-size-5xl)" }],
        ["text-6xl", { "font-size": "var(--font-size-6xl)" }],

        // Line heights
        ["leading-none", { "line-height": "var(--line-height-none)" }],
        ["leading-extra-tight", { "line-height": "var(--line-height-extra-tight)" }],
        ["leading-base", { "line-height": "var(--line-height-base)" }],
        ["leading-relaxed", { "line-height": "var(--line-height-relaxed)" }],
        ["leading-tight", { "line-height": "var(--line-height-tight)" }],

        // Spacing from tokens
        ["space-1", { gap: "var(--space-1)" }],
        ["space-2", { gap: "var(--space-2)" }],
        ["space-3", { gap: "var(--space-3)" }],
        ["space-4", { gap: "var(--space-4)" }],
        ["space-6", { gap: "var(--space-6)" }],
        ["space-8", { gap: "var(--space-8)" }],
        ["space-12", { gap: "var(--space-12)" }],

        // Gradient backgrounds - Space Radio
        ["bg-gradient-warm-cool", { background: "var(--gradient-warm-to-cool)" }],
        ["bg-gradient-cosmic", { background: "var(--gradient-cosmic)" }],
        ["bg-gradient-radio-glow", { background: "var(--gradient-radio-glow)" }],
        ["bg-gradient-cosmic-subtle", { background: "var(--gradient-bg-cosmic)" }],
        ["bg-gradient-radio-subtle", { background: "var(--gradient-bg-radio)" }],

        // Gradient text utilities - Space Radio
        [
            /^text-gradient-(.+)$/,
            ([, c]) => ({
                "background-image": `var(--gradient-${c})`,
                "-webkit-background-clip": "text",
                "background-clip": "text",
                "-webkit-text-fill-color": "transparent",
                color: "transparent",
            }),
        ],
    ],
});
