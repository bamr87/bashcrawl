// The Chronicle: the dungeon's story, told in chapters the hero earns — a
// prologue at creation, one chapter per main quest (the engine's eight), one
// per hidden hall the first time it is entered, an epilogue when the main
// road is walked. Text is authored here with {name} and {path} placeholders
// and rendered for the hero when shown, so a rename reaches old chapters.
// The engine knows nothing of this: the quests and rooms are its, the
// narration is the web's.
import type { Hero } from "../hero/hero-store";
import { roleMeta } from "../hero/roles";

export type ChapterKey = "prologue" | "epilogue" | `quest:${number}` | `room:${string}`;

export interface Chapter {
    key: ChapterKey;
    /** Roman numeral for the main road; blank for halls. */
    numeral: string;
    title: string;
    text: string[];
    /** Where the road leads next, in the hero's words. */
    next?: string;
}

const ROAD: Array<Omit<Chapter, "key"> & { key: ChapterKey }> = [
    {
        key: "prologue",
        numeral: "Prologue",
        title: "The Descent Begins",
        text: [
            "The torches gutter as the door seals behind you, {name}. Somewhere below, the catacombs of the Shell wait: stone halls that are directories, scrolls that are files, treasures that are programs sleeping until someone dares to run them.",
            "You carry no map. You carry something better — a prompt, and the will to type into it. Every word you speak here is a real word; the dungeon only pretends to be a dungeon.",
            "A {path} walks these halls their own way. Yours begins now.",
        ],
        next: "Cast `pwd` to learn where you stand.",
    },
    {
        key: "quest:0",
        numeral: "I",
        title: "Know Thy Place",
        text: [
            "You speak the first word — pwd — and the dark answers with a path: /entrance. Not a riddle, a fact. Every room in this dungeon has a true name, and now you know how to ask for it.",
            "Already the stone feels less strange.",
        ],
        next: "`ls` reveals what shares the room with you.",
    },
    {
        key: "quest:1",
        numeral: "II",
        title: "Eyes to See",
        text: [
            "Light pools where you look. A scroll on a pedestal, a README no one has read in an age, a stair going down into the cellar.",
            "`ls` is a spell of sight. You will cast it a thousand times and never be lost again.",
        ],
        next: "Take the stair: `cd cellar`.",
    },
    {
        key: "quest:2",
        numeral: "III",
        title: "First Steps",
        text: [
            "The cellar is cold and smells of iron. Shapes line the walls — some are doors, some are things — and the scroll here teaches the trick of telling them apart. A chest glints in the corner.",
            "You moved through the dungeon by will alone. The map in your journal grows.",
        ],
        next: "Read the scroll with `cat scroll`; open the chest with `./treasure`.",
    },
    {
        key: "quest:3",
        numeral: "IV",
        title: "Ancient Knowledge",
        text: [
            "The scroll unrolls across your mind. Illusions are strong here, it says, and shows you how to see through them.",
            "`cat` is how the dungeon speaks to you — every scroll, every README, every note a stranger left on a workbench. Read everything; the walls remember.",
        ],
        next: "Return above with `cd ..` and conjure a room of your own: `mkdir workshop`.",
    },
    {
        key: "quest:4",
        numeral: "V",
        title: "Shape the World",
        text: [
            "Back in the entrance hall you raise your hands and a door appears where none was. The workshop. It did not exist until you named it.",
            "This is the secret the old scrolls circle around: you are not merely exploring the dungeon. You are allowed to build it.",
        ],
        next: "Step inside with `cd workshop` and forge something: `touch notes.txt`.",
    },
    {
        key: "quest:5",
        numeral: "VI",
        title: "Spark of Creation",
        text: [
            "A blank page, conjured from nothing, lies on the workbench. notes.txt. It holds no words yet; it holds the possibility of words.",
            "Files are made like this — a touch, a name — and unmade just as easily. You learn to be careful.",
        ],
        next: "Scrolls hide clues. Hunt one in the cellar: `grep catacombs scroll`.",
    },
    {
        key: "quest:6",
        numeral: "VII",
        title: "Seek the Whisper",
        text: [
            "You lean close to the cellar scroll and ask it one question: where is the word? grep finds it in a heartbeat — a line you would have read past a dozen times.",
            "Searching is a kind of sight too, sharper than eyes. The deeper halls — the chapel, the vault — reward it.",
        ],
        next: "Carry the amulet and the coins to the library's hidden study, and `source grimoire`.",
    },
    {
        key: "quest:7",
        numeral: "VIII",
        title: "The Bashcrawl Grimoire",
        text: [
            "Behind the library bookshelf, in a study the dust forgot, the grimoire opens for you. Its words become part of your shell: a command that did not exist a moment ago answers to your voice.",
            "You came down here to learn the terminal. Somewhere along the way the terminal learned you.",
        ],
        next: "Beyond the vault, a rift. Beyond the rift, a pit — and something that crawls.",
    },
    {
        key: "epilogue",
        numeral: "Epilogue",
        title: "The Archmage's Road",
        text: [
            "The main road is walked, {name}; eight chapters of the chronicle are written in your hand. But the catacombs are older than any road. The rift still breathes, the spire still climbs, the satellite still counts its checksums in the dark.",
            "Go back for the halls you missed. Beat your own time in the Arena. Teach someone else the first word.",
            "The prompt is yours now.",
        ],
    },
];

const HALLS: Array<[slug: string, title: string, text: string[]]> = [
    ["armoury", "The Armoury", ["Steel sweats on the racks. The armoury teaches the oldest law of this place: nothing runs until you give it leave. A sword is only a file until you make it executable."]],
    ["chamber", "The Chamber", ["The chamber hums. A stone guardian stands where the corridor narrows and a spell lies ready on the floor — read it before you cast it.", "Here the dungeon stops being gentle."]],
    ["chapel", "The Writing on the Wall", ["Blood on the wall says TURN BACK. You do not.", "The chapel keeps its rooms behind dots — hidden from ordinary sight, plain to `ls -a`. Everything you were not supposed to see is down here."]],
    ["graveyard", "The Graveyard", ["Mist to the knees, names on the stones. The graveyard is a filing system for the dead, and somewhere among the niches and tombs a padlock waits for three numbers."]],
    ["columbarium", "The Columbarium", ["Rows of niches, each with a symbol. One opens to the right touch."]],
    ["lower-quadrant", "The Lower Quadrant", ["Weathered stones, dates and names. Whoever sorted these did it by hand, long ago."]],
    ["royal-tombs", "The Royal Tombs", ["Ornate tombs of rulers nobody remembers. A crown belongs on one statue and only one."]],
    ["mausoleum", "The Mausoleum", ["Behind the padlock, the crypt. The air tastes of ash and sorted lists; even the dead here keep their records in order."]],
    ["courtyard", "The Courtyard", ["A fountain, a pile of rags, a sky you had forgotten. The courtyard asks a patient question of every file — what are you, really? — and `file` answers it."]],
    ["aviary", "The Aviary", ["Frost on the feathers. A penguin regards you with the calm of something that has been fed before.", "Tab completes names here. It would be rude to misspell a bird's."]],
    ["hall", "The Great Hall", ["The great hall is long enough to lose a word in. grep it for combat readiness before you go further — the monster at the far end does not warn twice."]],
    ["library", "The Ancient Library", ["Shelves to the dark. The library teaches you to teach yourself: `man`, `help`, `--help` — the dungeon's own scrolls about its own spells.", "A tome of random spells sits open on the lectern."]],
    ["study", "The Hidden Study", ["The bookshelf swings. In the hidden study the grimoire waits, and with it the last page of the main chronicle."]],
    ["vault", "The Sealed Vault", ["Sealed by variables, opened by them. The vault wants to know what you carry — `echo $I` — and what you call it.", "Put the crystal in the glass case and the stronghold yields."]],
    ["stronghold", "The Stronghold", ["Orbs on pedestals, a goblet behind them. Copies are cheap and the goblet knows it: `cp` the orbs, and somewhere above you the rift tears open."]],
    ["nursery", "The Nursery", ["Quiet, small, hidden potions. `find` sees what shelves hide."]],
    ["lab", "The Laboratory", ["The alchemist piped one flask into the next. So will you: `|` joins two spells into one, and a ghost in the glassware tests whether you understood."]],
    ["scrap", "The Scrap Heap", ["A heap of what was. Links point from one name to another — `ln -s` — and the scrapyard is full of pointers to things that moved."]],
    ["rift", "The Rift", ["The sky is red; mountains hang. Here spells chain: `&&` for when one succeeds, `||` for when one fails, `;` for *then*.", "Two paths diverge — the arena and the spire."]],
    ["arena", "The Arena", ["Sand, iron, a roar from below. Loops run the arena: do a thing, again, again, until the condition breaks."]],
    ["pit", "The Pit", ["The deepest point. The Crawling Chaos waits where the arena's sand runs out; check your health before you check your courage.", "A drummer in the dark knows a weakness."]],
    ["spire", "The Spire", ["Up. The spire teaches you to combine sights — `ls -a` with `grep` — and keeps a mezzanine with a button and a window."]],
    ["mezzanine", "The Mezzanine", ["A button calls an elevator that should not exist in a dungeon. Regex guards the door."]],
    ["elevator", "The Elevator", ["Between floors. The display counts in a base you did not choose."]],
    ["satellite", "The Satellite", ["Files in orbit around a checksum. Verify everything; trust nothing you have not summed."]],
];

export const CHAPTERS: Chapter[] = [
    ...ROAD.map((chapter) => ({ ...chapter })),
    ...HALLS.map(([slug, title, text]) => ({ key: `room:${slug}` as ChapterKey, numeral: "", title, text })),
];

const BY_KEY = new Map<string, Chapter>(CHAPTERS.map((chapter) => [chapter.key, chapter]));

export function chapterFor(key: string): Chapter | null {
    return BY_KEY.get(key) ?? null;
}

/** The chapter's text for this hero, placeholders filled. */
export function renderChapter(chapter: Chapter, hero: Hero | null): { title: string; pages: string[] } {
    const name = hero?.name ?? "Adventurer";
    const path = hero ? roleMeta(hero.role).title : "Wanderer";
    const fill = (text: string) => text.replaceAll("{name}", name).replaceAll("{path}", path);
    return { title: fill(chapter.title), pages: chapter.text.map(fill) };
}

/** Main-road chapters in order, for the journal's table of contents. */
export const ROAD_KEYS: ChapterKey[] = ROAD.map((chapter) => chapter.key);
