// A minimal external store for useSyncExternalStore: the app's state that
// lives outside React (the game runtime, preferences, toasts) is held in
// plain objects like this one and read through selectors. Selectors must
// return referentially stable values for unchanged state — primitives, or
// the state object itself, which is replaced wholesale on every set().
import { useSyncExternalStore } from "react";

export type Listener = () => void;

export interface Store<T> {
    get(): T;
    set(next: T | ((prev: T) => T)): void;
    subscribe(listener: Listener): () => void;
}

export function createStore<T>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<Listener>();
    return {
        get: () => state,
        set(next) {
            const value = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
            if (Object.is(value, state)) return;
            state = value;
            for (const listener of listeners) listener();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
}

const identity = <T,>(value: T): T => value;

export function useStore<T, S = T>(store: Store<T>, selector: (state: T) => S = identity as (state: T) => S): S {
    return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()));
}
