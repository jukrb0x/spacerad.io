// Original title easter-egg phrases, now a quiet companion to a stable wordmark.
let dispose: (() => void) | undefined;
let lastPhrase = "";

function initWordmarkWhisper() {
    dispose?.();
    const trigger = document.querySelector<HTMLAnchorElement>("[data-wordmark-trigger]");
    const whisper = trigger?.querySelector<HTMLElement>("[data-wordmark-whisper]");
    if (!trigger || !whisper) return;
    const phrases = JSON.parse(trigger.dataset.wordmarkPhrases || "[]") as string[];
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
        clearTimeout(timer);
        whisper.removeAttribute("data-visible");
    };
    const reveal = () => {
        // The compact header has no spare space; touch navigation stays one tap.
        if (!window.matchMedia("(min-width: 1100px)").matches || phrases.length === 0) return;
        hide();
        const choices = phrases.filter((phrase) => phrase !== lastPhrase);
        lastPhrase = choices[Math.floor(Math.random() * choices.length)] ?? phrases[0];
        whisper.textContent = lastPhrase;
        whisper.setAttribute("data-visible", "");
        timer = setTimeout(hide, 2500);
    };
    trigger.addEventListener(
        "pointerenter",
        (event) => {
            if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) reveal();
        },
        { signal: controller.signal },
    );
    trigger.addEventListener("pointerleave", hide, { signal: controller.signal });
    trigger.addEventListener(
        "focus",
        () => {
            if (trigger.matches(":focus-visible")) reveal();
        },
        { signal: controller.signal },
    );
    trigger.addEventListener("blur", hide, { signal: controller.signal });
    trigger.addEventListener("click", hide, { signal: controller.signal });
    dispose = () => {
        controller.abort();
        hide();
    };
}

document.addEventListener("astro:before-swap", () => dispose?.());
document.addEventListener("astro:page-load", initWordmarkWhisper);
