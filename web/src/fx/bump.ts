// Re-trigger a CSS animation on an element by toggling a class: remove,
// force a reflow so the browser notices, add, and clear after the run.
// One timer per element+class so a repeat restarts instead of overlapping.
const timers = new WeakMap<Element, Map<string, ReturnType<typeof setTimeout>>>();

export function bump(element: Element | null | undefined, className: string, ms = 400): void {
    if (!element || !className) return;
    const perElement = timers.get(element) ?? new Map<string, ReturnType<typeof setTimeout>>();
    timers.set(element, perElement);
    const pending = perElement.get(className);
    if (pending) clearTimeout(pending);
    element.classList.remove(className);
    void (element as HTMLElement).offsetWidth;
    element.classList.add(className);
    perElement.set(className, setTimeout(() => {
        element.classList.remove(className);
        perElement.delete(className);
    }, ms));
}
