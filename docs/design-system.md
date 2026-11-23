# Design system

> The web trainer's visual language: the principles, the tokens, the primitives every screen is built from, and the rules that keep them consistent.

The trainer was redesigned in November 2026 from a 16-bit dungeon skin (bevelled frames, notched corners, tracked upper-case mono type) to the language below. The game underneath is unchanged: the hero, the HUD, the quests and the effects are all still there. What changed is how they look and how a visitor arrives.

## Principles

1. **The terminal is the hero.** It is the darkest surface on the page and the only place mono type is the default. Chrome around it stays quiet so the eye lands on the prompt.
2. **One accent.** Amber (`--fleet-color-primary`) marks the brand, the one primary action on a screen, focus and the selected state. Green, blue and violet carry meaning inside the game (success, paths, story), never decoration.
3. **Flat surfaces, hairline borders, soft corners.** A card is a fill, a 1px line and a radius. Elevation (a shadow) is for things that float: dialogs, the consent bar, toasts.
4. **Sentence case, a sans UI face.** Headings are sans, semibold and slightly tight. Upper case is reserved for the small "eyebrow" label above a heading or a group.
5. **Line icons, not emoji, in the chrome.** Icons come from `lucide-react` and are drawn in `currentColor`. Emoji that are part of the game's content (a room's sigil, an achievement) stay content.
6. **Phone first for layout.** One header row at every width; the doors are a segmented control on a desktop and a tab bar on a phone; anything that needs a keyboard shortcut also has a button.
7. **Motion explains, it does not decorate.** Everything that moves is gated on `prefers-reduced-motion` and the Effects option.

## Tokens

Every design value is a custom property in [`web/src/styles/tokens.css`](../web/src/styles/tokens.css), the only file allowed a colour literal or a numeric `z-index` (`web/src/test/theme.test.ts` enforces it). `--fleet-*` names are the fleet's semantic roles; `--bc-*` are this skin's additions.

| Group | Tokens | Notes |
| --- | --- | --- |
| Surfaces | `--fleet-color-bg`, `-bg-elevated`, `-bg-muted`, `--bc-color-surface-raised`, `--bc-color-term-bg` | Page, card, control, floating card, terminal. |
| Lines | `--fleet-color-border`, `--bc-color-border-strong` | The hairline; the stronger line for controls and floating cards. |
| Text | `--fleet-color-ink`, `-ink-muted`, `--bc-color-on-primary` | `on-primary` is the text colour on an amber fill. |
| Accent and meaning | `--fleet-color-primary`, `-secondary`, `-accent`, `-success`, `-info`, `-warning`, `-danger` | Dark and light values both meet 4.5:1 on their surface for text. |
| Type | `--fleet-font-sans`, `--fleet-font-mono`, `--fleet-text-xs…h1`, `--bc-text-hero`, `--bc-display-tracking`, `--bc-eyebrow-tracking` | System stacks only, no webfont. |
| Shape | `--fleet-radius-sm` 6px, `-base` 8px, `-lg` 12px, `-xl` 16px, `-pill` | Controls use `base`, cards `lg`, dialogs `xl`. |
| Elevation | `--fleet-shadow-xs…lg` | Built from `--bc-color-shadow`, so the light theme's are lighter. |
| Layout | `--bc-header-height`, `--bc-content-max`, `--fleet-space-*` | |
| Layers | `--fleet-layer-*` | The only `z-index` values in the app. |

Colour mode is `data-theme="dark|light|auto"` on `<html>` with the resolved scheme in `data-resolved`; the light block in `tokens.css` re-maps the same roles. Read a colour in canvas code with `colorOf(role)`.

## Primitives

Defined in [`web/src/styles/app.css`](../web/src/styles/app.css) and used by class name.

| Class | Use |
| --- | --- |
| `.bc-frame` | A card. The hairline is an inset shadow, so a component can add elevation next to it. |
| `.bc-btn` | A button. Add `.bc-btn-primary` (one per screen), `.bc-btn-ghost` (chrome that should not compete), `.bc-btn-icon` (square, icon only; give it an `aria-label`), `.bc-btn-lg` (page-level calls to action), `.bc-btn-danger`. |
| `.bc-display` | A heading in the UI face. |
| `.bc-eyebrow` | The small tracked upper-case label. |
| `.bc-kbd` | A key cap. |
| `.bc-chip` | A command suggestion: mono, pill-shaped, fills the prompt and never runs. |
| `.bc-input` | A text field. Inside `.bc-prompt` it loses its own box: the prompt is the box. |
| `.bc-link` | A text button. |
| `.bc-seg` / `.bc-seg-btn`, `.bc-switch` | The segmented control and the switch in Options. |

## Layout

- **Shell** (`web/src/app/AppShell.tsx`): skip link, a header of fixed height (brand, the four doors, actions), the status strip, `<main>`, the prompt dock, a slim footer on wide screens. Actions marked `.bc-action-wide` are hidden under 900px, where the menu button (`.bc-action-narrow`) reaches them.
- **Home page** (`web/src/screens/LandingScreen.tsx`, `landing.css`): the pitch beside a working sandbox terminal, the four doors, how it works, what is taught, classrooms and the real shell, the project footer. It scrolls inside `<main>`.
- **Doors**: a side column of panel cards, the terminal window, the dock. Under 900px the side column becomes an overlay opened from the status strip.

## Rules

- No colour literal and no numeric `z-index` outside `tokens.css`.
- Art (ASCII Motion clips) is drawn only through `Shell#art(name)` or `<ArtClip name>`.
- A tooltip is a `title` attribute and nothing else; `Tooltips.tsx` turns it into the app's own tooltip layer.
- An icon-only button always carries an `aria-label`; an icon beside text is `aria-hidden`.
- The reader layer never rewrites a scroll's text to make it prettier; teach the classifier a convention instead.
- Text fields that take focus on a phone are at least 16px, so iOS does not zoom the page.
