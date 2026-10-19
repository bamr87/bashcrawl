// The generated content bundles (scripts/export_static_web.py → web/data),
// fetched relative to the page so the same build serves from a Pages
// project path, a local preview and the dev server.
import type { GameData } from "./types";

const FILES: Array<keyof GameData> = ["world", "quests", "progression", "courses", "commands", "docs", "arcade"];

async function fetchJson(name: string): Promise<unknown> {
    const url = new URL(`./data/${name}.json`, document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load data/${name}.json (${response.status})`);
    return response.json();
}

export async function loadGameData(): Promise<GameData> {
    const entries = await Promise.all(FILES.map(async (name) => [name, await fetchJson(name)] as const));
    return Object.fromEntries(entries) as unknown as GameData;
}
