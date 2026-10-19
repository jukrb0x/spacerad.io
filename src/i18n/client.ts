import { atom } from "nanostores";
import { LANGUAGE_STORAGE_KEY, resolveLanguage, type UILanguage } from "./language";

function browserLanguage(): UILanguage {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* Storage can be disabled. */ }
    return resolveLanguage(stored, navigator.languages ?? [navigator.language]);
}
export const uiLanguage = atom<UILanguage>(browserLanguage());

export function applyLanguage(root: ParentNode = document, language = uiLanguage.get()) {
    if (root instanceof Document) root.documentElement.dataset.uiLanguage = language;
    root.querySelectorAll<HTMLElement>("[data-i18n-en][data-i18n-zh]").forEach((element) => {
        const text = language === "zh" ? element.dataset.i18nZh! : element.dataset.i18nEn!;
        const attribute = element.dataset.i18nAttr;
        if (attribute) element.setAttribute(attribute, text);
        else { element.textContent = text; element.lang = language; }
    });
    root.querySelectorAll<HTMLButtonElement>("[data-language-toggle]").forEach((button) => {
        button.lang = language === "zh" ? "en" : "zh";
        const label = language === "zh" ? "Switch interface to English" : "切换为中文界面";
        button.setAttribute("aria-label", label);
        button.title = label;
    });
    // Authored prose retains its own language; only UI fragments are translated.
    root.querySelectorAll<HTMLElement>("[data-ui-lang]").forEach((element) => {
        element.hidden = element.dataset.uiLang !== language;
    });
}

export function setUILanguage(language: UILanguage) {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* In-memory preference still works. */ }
    uiLanguage.set(language);
}
uiLanguage.subscribe(() => {
    applyLanguage();
    document.dispatchEvent(new CustomEvent("ui:language-change", { detail: uiLanguage.get() }));
});
// Delegation survives Header replacement; this module executes once.
document.addEventListener("click", (event) => {
    if ((event.target as Element)?.closest?.("[data-language-toggle]")) {
        setUILanguage(uiLanguage.get() === "zh" ? "en" : "zh");
    }
});
document.addEventListener("astro:before-swap", (event) => {
    applyLanguage((event as Event & { newDocument: Document }).newDocument);
});
document.addEventListener("astro:page-load", () => applyLanguage());
window.addEventListener("storage", (event) => {
    if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) uiLanguage.set(browserLanguage());
});
window.addEventListener("languagechange", () => uiLanguage.set(browserLanguage()));
