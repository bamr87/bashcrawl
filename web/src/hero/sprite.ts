// The hero sprite: a 16×28 pixel character composed from parts — companion,
// cape, body, outfit, hair, headgear, eyes, weapon — each a bitmap of colour
// SLOTS ('s' skin, 'c' cloth, 'm' metal…) that CSS resolves to the --hero-*
// variables, so one bitmap serves every palette. `compose` rasterises the
// parts in order (a later part hides what it covers) and returns horizontal
// runs per layer; HeroSprite.tsx turns them into <rect>s. The bitmaps are
// pixel masks for those rects, not text art (termforge/test/art.test.js
// exempts this file like gem.js), authored as template literals so each row
// reads as the picture it is.
import type { Appearance, Companion, HairStyle, Headgear, Outfit, Weapon } from "./appearance";

export const SPRITE_W = 16;
export const SPRITE_H = 28;
/** The eyes' row, for tests and the bust crop. */
export const EYE_ROW = 8;

export type Slot = "o" | "s" | "S" | "h" | "H" | "c" | "C" | "t" | "m" | "M" | "l" | "L" | "b" | "B" | "e" | "w" | "g" | "p" | "P";

/** Slot → the --hero-<name> variable that colours it. */
export const SLOT_VARS: Record<Slot, string> = {
    o: "outline",
    s: "skin",
    S: "skin-shade",
    h: "hair",
    H: "hair-shade",
    c: "cloth",
    C: "cloth-shade",
    t: "trim",
    m: "metal",
    M: "metal-shade",
    l: "leather",
    L: "leather-shade",
    b: "cape",
    B: "cape-shade",
    e: "eye",
    w: "white",
    g: "gem",
    p: "pet",
    P: "pet-shade",
};

export const LAYERS = ["companion", "cape", "body", "outfit", "hair", "headgear", "eyes", "weapon"] as const;
export type LayerName = (typeof LAYERS)[number];

export interface Part {
    /** The row the bitmap's first line lands on. */
    y: number;
    rows: string[];
}

function part(y: number, text: string): Part {
    return { y, rows: text.split("\n").map((row) => row.trim()).filter(Boolean) };
}

// ── body ──────────────────────────────────────────────────────────────────
const BODY = part(4, `
.....oooooo.....
....osssssso....
....osssssso....
....osssssso....
....osssssso....
....osssssso....
....oSssssSo....
.....oSSSSo.....
......osso......
`);

const EYES = part(EYE_ROW, `
......e..e......
`);

// ── outfits (rows 13–26: shoulders, arms with hands, belt, legs, boots) ───
const OUTFIT_PARTS: Record<Outfit, Part> = {
    tunic: part(13, `
....oCccccCo....
..ooccccccccoo..
..ocoCccccCoco..
..osoccccccoso..
..osoccccccoso..
..osottttttoso..
..oSoccccccoSo..
...ooccccccoo...
....oCCooCCo....
....oCCooCCo....
....oCCooCCo....
....olloollo....
....olloollo....
...oooo..oooo...
`),
    robe: part(13, `
....oCccccCo....
..occcccccccco..
..ocoCttttCoco..
..ocoCccccCoco..
..ocoCccccCoco..
..osoctcctcoso..
..oSoccccccoSo..
...occcccccco...
...occcccccco...
...occcccccco...
...oCccccccCo...
...otttttttto...
....olloollo....
...oooo..oooo...
`),
    leather: part(13, `
....oCccccCo....
..ooccccccccoo..
..osoclcclcoso..
..osoclcclcoso..
..oloclcclcolo..
..olollllllolo..
..oSoccccccoSo..
...ooCCCCCCoo...
....oCCooCCo....
....oCCooCCo....
....olloollo....
....olloollo....
....oLLooLLo....
...oooo..oooo...
`),
    plate: part(13, `
....oMmmmmMo....
..oommmmmmmmoo..
..omoMmmmmMomo..
..omoMmttmMomo..
..omoMmmmmMomo..
..oMottttttoMo..
..oSommmmmmoSo..
...ooMMMMMMoo...
....oCCooCCo....
....oCCooCCo....
....ommoommo....
....ommoommo....
....oMMooMMo....
...oooo..oooo...
`),
    coat: part(13, `
....otttttto....
..occttttttcco..
..ococcccccoco..
..ococCccCcoco..
..ocoCccccCoco..
..osoccccccoso..
..oSoccccccoSo..
...occcccccco...
...oc.oCCo.co...
...oc.oCCo.co...
...oo.ollo.oo...
....olloollo....
....olloollo....
...oooo..oooo...
`),
};

// ── hair (over the head; a '.' keeps the face underneath) ─────────────────
const HAIR_PARTS: Record<HairStyle, Part | null> = {
    short: part(3, `
......hhhh......
....ohhhhhho....
...ohhhhhhhho...
...ohH....Hho...
....oh....ho....
`),
    long: part(3, `
......hhhh......
....ohhhhhho....
...ohhhhhhhho...
...ohh....hho...
...oh......ho...
...oh......ho...
...oh......ho...
...oh......ho...
...ohh....hho...
....oo....oo....
`),
    braid: part(3, `
......hhhh......
....ohhhhhho....
...ohhhhhhhho...
...ohh....hho...
....o......oho..
...........oho..
...........oHo..
...........oho..
...........oHo..
...........ohho.
............oo..
`),
    mohawk: part(1, `
.......oo.......
......ohho......
......ohho......
.....oohhoo.....
....oSohhoSo....
....oS.hh.So....
`),
    curly: part(2, `
.....hhhhhh.....
....hhHhhHhh....
...ohhhhhhhho...
..ohHhhhhhhHho..
..ohh......hho..
..ohh......hho..
...ohh....hho...
....oo....oo....
`),
    bald: null,
};

// ── headgear (over the hair; the eyes are drawn above it) ─────────────────
const HEADGEAR_PARTS: Record<Headgear, Part | null> = {
    none: null,
    hood: part(2, `
......cccc......
...occcccccco...
..occcccccccco..
..occcccccccco..
..oco......oco..
..oco......oco..
..oco......oco..
..oCo......oCo..
..oCc......cCo..
...oCc....cCo...
....oCcccccCo...
`),
    hat: part(0, `
.......oo.......
......occo......
......ocgo......
.....occcco.....
....occcccco....
..occcccccccco..
...oCCCCCCCCo...
`),
    helm: part(3, `
.....mmmmmm.....
....ommmmmmo....
....ommmmmmo....
....oMmmmmMo....
....oM.ss.Mo....
....oM....Mo....
....oMMmmMMo....
`),
    crown: part(2, `
....t.t..t.t....
....tttttttt....
....otgttgto....
`),
    bandana: part(4, `
....occcccco....
....occccccoco..
...........oco..
............o...
`),
    circlet: part(5, `
....otttttto....
`),
};

// ── weapons (in the right hand, columns 12–15) ────────────────────────────
const STAFF_ROWS = Array.from({ length: 18 }, () => ".............olo").join("\n");
const WEAPON_PARTS: Record<Weapon, Part | null> = {
    sword: part(9, `
..............o.
.............omo
.............omo
.............omo
.............omo
.............omo
.............omo
.............omo
.............omo
............ottt
.............olo
.............olo
.............oto
..............o.
`),
    staff: part(4, `
..............g.
.............ggg
..............g.
${STAFF_ROWS}
..............o.
`),
    dagger: part(15, `
..............o.
.............omo
.............omo
............ottt
.............olo
..............o.
`),
    bow: part(10, `
..............o.
.............ol.
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
............ol.w
.............ol.
..............o.
`),
    tome: part(16, `
...........oooo.
...........ocwo.
...........ocwo.
...........ocwo.
...........oooo.
`),
    lantern: part(17, `
.............oo.
............otto
............oggo
............oggo
............otto
.............oo.
`),
    none: null,
};

// ── a cape (behind everything but the companion) ──────────────────────────
const CAPE = part(13, `
...obbbbbbbbo...
..obbbbbbbbbbo..
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.obbbbbbbbbbbbo.
.oBbbbbbbbbbbBo.
.oBBbbbbbbbbBBo.
.oBBBBBBBBBBBBo.
..oooooooooooo..
`);

// ── companions (columns 0–3, beside the feet or the head) ─────────────────
const COMPANION_PARTS: Record<Companion, Part | null> = {
    none: null,
    cat: part(21, `
p..p............
pppp............
pepe............
pppp............
pppp............
pP.P............
`),
    bat: part(5, `
p..p............
pppp............
pepp............
.pp.............
.p.p............
`),
    slime: part(23, `
.pp.............
pepe............
pppp............
PppP............
`),
    owl: part(21, `
p..p............
pppp............
pepe............
pPPp............
pppp............
.p.p............
`),
    frog: part(23, `
e..e............
pppp............
pppp............
p..p............
`),
};

export interface Run {
    x: number;
    y: number;
    w: number;
    slot: Slot;
}

export interface Layer {
    name: LayerName;
    runs: Run[];
}

interface Cell {
    slot: Slot;
    layer: LayerName;
}

const SLOTS = new Set(Object.keys(SLOT_VARS));

function paint(grid: Array<Cell | null>, layer: LayerName, piece: Part | null): void {
    if (!piece) return;
    piece.rows.forEach((row, dy) => {
        const y = piece.y + dy;
        for (let x = 0; x < row.length; x++) {
            const ch = row[x];
            if (!ch || ch === ".") continue;
            if (!SLOTS.has(ch)) throw new Error(`${layer}: unknown slot '${ch}' at ${x},${y}`);
            if (x >= SPRITE_W || y >= SPRITE_H || y < 0) throw new Error(`${layer}: out of bounds at ${x},${y}`);
            grid[y * SPRITE_W + x] = { slot: ch as Slot, layer };
        }
    });
}

/** The parts an appearance selects, in drawing order. */
export function partsFor(a: Appearance): Array<[LayerName, Part | null]> {
    return [
        ["companion", COMPANION_PARTS[a.companion]],
        ["cape", a.cape == null ? null : CAPE],
        ["body", BODY],
        ["outfit", OUTFIT_PARTS[a.outfit]],
        ["hair", HAIR_PARTS[a.hair]],
        ["headgear", HEADGEAR_PARTS[a.headgear]],
        ["eyes", EYES],
        ["weapon", WEAPON_PARTS[a.weapon]],
    ];
}

/** Rasterise the parts and return each layer's visible horizontal runs. */
export function compose(a: Appearance): Layer[] {
    const grid: Array<Cell | null> = new Array<Cell | null>(SPRITE_W * SPRITE_H).fill(null);
    for (const [layer, piece] of partsFor(a)) paint(grid, layer, piece);
    const runs = new Map<LayerName, Run[]>(LAYERS.map((name) => [name, []]));
    for (let y = 0; y < SPRITE_H; y++) {
        let x = 0;
        while (x < SPRITE_W) {
            const cell = grid[y * SPRITE_W + x];
            if (!cell) {
                x++;
                continue;
            }
            let w = 1;
            while (x + w < SPRITE_W) {
                const next = grid[y * SPRITE_W + x + w];
                if (!next || next.slot !== cell.slot || next.layer !== cell.layer) break;
                w++;
            }
            runs.get(cell.layer)?.push({ x, y, w, slot: cell.slot });
            x += w;
        }
    }
    return LAYERS.map((name) => ({ name, runs: runs.get(name) ?? [] }));
}

/** Every authored bitmap, for the width/bounds test. */
export function allParts(): Array<{ name: string; part: Part }> {
    const out: Array<{ name: string; part: Part }> = [{ name: "body", part: BODY }, { name: "eyes", part: EYES }, { name: "cape", part: CAPE }];
    const add = (prefix: string, record: Record<string, Part | null>) => {
        for (const [key, value] of Object.entries(record)) if (value) out.push({ name: `${prefix}:${key}`, part: value });
    };
    add("outfit", OUTFIT_PARTS);
    add("hair", HAIR_PARTS);
    add("headgear", HEADGEAR_PARTS);
    add("weapon", WEAPON_PARTS);
    add("companion", COMPANION_PARTS);
    return out;
}

/** Problems with the authored bitmaps: a row of the wrong width, a part past the canvas. */
export function validateParts(): string[] {
    const problems: string[] = [];
    for (const { name, part: piece } of allParts()) {
        piece.rows.forEach((row, i) => {
            if (row.length !== SPRITE_W) problems.push(`${name} row ${i} is ${row.length} wide: ${row}`);
        });
        if (piece.y < 0 || piece.y + piece.rows.length > SPRITE_H) problems.push(`${name} runs past the canvas`);
    }
    return problems;
}
