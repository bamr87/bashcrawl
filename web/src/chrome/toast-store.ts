// The one toast system (UPS-FE-18): a queue rendered by <Toaster> into a
// role="status" live region. Variants colour the text; timeouts are plain
// timers (reduced motion changes the animation, not the dwell time).
import { createStore, useStore } from "../lib/store";

export type ToastVariant = "info" | "success" | "error" | "magic";

export interface ToastItem {
    id: number;
    text: string;
    variant: ToastVariant;
}

const DEFAULT_TTL = 2600;
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const store = createStore<ToastItem[]>([]);

export function dismissToast(id: number): void {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    store.set(store.get().filter((item) => item.id !== id));
}

export function toast(text: string, variant: ToastVariant = "info", ttl = DEFAULT_TTL): number {
    const id = nextId++;
    store.set([...store.get().slice(-3), { id, text, variant }]);
    if (ttl > 0) timers.set(id, setTimeout(() => dismissToast(id), ttl));
    return id;
}

export function clearToasts(): void {
    for (const id of Array.from(timers.keys())) dismissToast(id);
    store.set([]);
}

export function useToasts(): ToastItem[] {
    return useStore(store);
}
