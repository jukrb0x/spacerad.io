// Original title easter-egg phrases, now a quiet companion to a stable wordmark.
let dispose: (() => void) | undefined;
let lastPhrase = "";

function initWordmarkWhisper() {
    dispose?.();
    const trigger = document.querySelector<HTMLAnchorElement>("[data-wordmark-trigger]");
    const whisper = trigger?.querySelector<HTMLElement>("[data-wordmark-whisper]");
    if (!trigger || !whisper) return;
    const controls = trigger.closest("nav")?.querySelector<HTMLElement>(".site-header__controls");
    const phrases = JSON.parse(trigger.dataset.wordmarkPhrases || "[]") as string[];
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
        clearTimeout(timer);
        whisper.removeAttribute("data-visible");
    };
    const place = () => {
        if (!whisper.hasAttribute("data-visible")) return;
        // Measure the actual phrase at its side size, leaving breathing room before navigation.
        whisper.setAttribute("data-placement", "right");
        const boundary = controls?.getBoundingClientRect().left ?? window.innerWidth - 24;
        if (whisper.getBoundingClientRect().right + 20 > boundary) {
            whisper.setAttribute("data-placement", "below");
        }
    };
    const observer = new ResizeObserver(place);
    observer.observe(trigger);
    if (controls) observer.observe(controls);
    window.addEventListener("resize", place, { signal: controller.signal });
    document.addEventListener("ui:language-change", place, { signal: controller.signal });
    document.fonts?.ready.then(() => {
        if (!controller.signal.aborted) place();
    });
    const reveal = () => {
        if (phrases.length === 0) return;
        hide();
        const choices = phrases.filter((phrase) => phrase !== lastPhrase);
        lastPhrase = choices[Math.floor(Math.random() * choices.length)] ?? phrases[0];
        whisper.textContent = lastPhrase;
        whisper.setAttribute("data-visible", "");
        place();
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
        observer.disconnect();
        hide();
    };
}

document.addEventListener("astro:before-swap", () => dispose?.());
document.addEventListener("astro:page-load", initWordmarkWhisper);
