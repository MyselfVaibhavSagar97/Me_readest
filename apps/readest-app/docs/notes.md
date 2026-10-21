# Handwritten notes

The notes feature is a standalone handwriting app living inside the library:
a Notes button opens a home screen of notes and folders, and a note opens a
full-screen page written on with a stylus, a finger or a mouse.

It is built on the reader's existing ink engine rather than beside it. The
reader has drawn on book pages since before notes existed, and everything
that is hard about ink — pressure, palm rejection, undo, storing strokes so
they survive a different screen — was already solved there. A note is
another surface for the same engine.

**Read this before changing anything under `src/services/handwriting/`,
`src/services/notes/`, or the notes components.** It says which layer a
change belongs in, and what each layer promises the others.

## The layers

```
    src/app/library/components/        the screen: what it looks like
      QuickNotes · NotesHome · QuickNoteEditor · NotePreview
      PenPanel · HighlighterPanel · EraserPanel · ToolPanelParts
                         |
    src/app/library/hooks/             the session: what is selected now
      useQuickNoteInk
                         |
    src/services/notes/                the note: settings, folders, the file
      penSettings · noteTree · quickNotePersistence
                         |
    src/services/handwriting/          the ink: strokes, nibs, erasing
      handwritingService · editor · renderer · nibs · pointEraser
      stabilizer · pointerBackend · booxBackend · model
```

Each layer may only reach downward. A rule of thumb that has held so far:
**if a change is about how something looks, it belongs in the top layer
only.** Cosmetic work that reaches past the hook is a sign the seam is in
the wrong place — move the seam, don't cross it.

### `src/services/handwriting/` — the ink

Shared with the reader. A change here changes the reader too, so it is the
layer to be most careful in, and the one to extend rather than alter.

| Module | What it owns |
| --- | --- |
| `model.ts` | What a stroke is. Points are `[x, y, pressure?]` in page fractions. |
| `nibs.ts` | Nib geometry as pure functions: how pressure and direction change a nib's width and alpha. |
| `renderer.ts` | Drawing strokes onto a 2D context. The only place that paints. |
| `editor.ts` | Strokes per page, undo/redo, erasing (whole-stroke, pixel, lasso). |
| `pointEraser.ts` | The geometry of a partial erase: which runs of a stroke the eraser covered, and splitting it. |
| `stabilizer.ts` | Smoothing a stroke as it is drawn. |
| `pointerBackend.ts` | Pointer events → strokes, including palm rejection. |
| `booxBackend.ts` | The same, on BOOX hardware's own pen API. |
| `handwritingService.ts` | The façade the UI talks to: a tool, its options, and a canvas. |

Three properties of this layer are load-bearing. Breaking one is how ink
gets lost, so each has checks of its own:

1. **Strokes are stored normalized** — `0..1` relative to the page, never in
   pixels. The same strokes fill a tablet, a phone and a 120px thumbnail, so
   nothing has to be re-captured when a note is saved or a screen rotates.
2. **Ink the reader already stored renders byte-identically.** New fields
   (`nib`, `sensitivity`) are optional, and `nibFields()` in the service
   only writes one when it differs from the default, so a reader stroke is
   stored exactly as it was before notes existed. `pressureScale('fountain',
   p, 1) === 0.5 + p` reproduces the original renderer's curve on purpose —
   that identity is a test, not a coincidence.
3. **Defaults are the reader's behaviour.** `erase()` defaults to
   `mode: 'stroke'`, `target: 'all'`; a new option is added with the default
   that leaves the reader as it was.

### `src/services/notes/` — the note

Notes only. Pure functions and one file format; no React, no canvas.

- **`penSettings.ts`** — what the panels set, in units a person recognizes.
  A note page is A4, so `PAGE_WIDTH_MM = 210` makes a thickness in
  millimetres meaningful, and `mmToFraction` converts at the boundary.
  `PAPER_COLOR` lives here too, so the page and every preview of a tool read
  from one value and a sample can never sit on different paper than the page
  it claims to show.
- **`noteTree.ts`** — folders as paths (`Maths/Week 1`), derived rather than
  stored where possible: `allFolders` recovers a folder from the notes in it,
  so ink is never stranded by a missing folder record.
- **`quickNotePersistence.ts`** — the file. Notes and folders are parsed
  independently, so a damaged folder list cannot take the notes down, and a
  file written before folders existed reads as every note at the top level.

### `src/app/library/hooks/useQuickNoteInk.ts` — the session

One hook owns everything that is "selected right now": the pen, highlighter
and eraser settings, which tool is active, stylus-only, undo/redo, and
clearing the page. It feeds the service and hands the panels their values.

This is the seam that matters most for the future. Panels read and write
settings through this hook and know nothing about the engine; the engine
knows nothing about panels. A new tool is a settings type, a hook field and
a panel — in that order — and nothing below has to move.

### `src/app/library/components/` — the screen

- **`QuickNotes.tsx`** — the Notes button and what it opens.
- **`NotesHome.tsx`** — folders, breadcrumbs, note cards, sorting, renaming,
  moving, deleting.
- **`NotePreview.tsx`** — a note drawn small, through the real renderer. No
  thumbnail is ever captured or cached: normalized strokes make the preview
  free, and it cannot go stale.
- **`QuickNoteEditor.tsx`** — the page and the toolbar. Panels drop down
  from the tool they belong to.
- **`ToolPanelParts.tsx`** — the pieces every panel is built from:
  `ToolPanel`, `SliderRow`, `SwitchRow`, `ColorRail`, `StrokePreview`.
  **Restyling a panel means editing this file, not the three panels.**
- **`PenPanel` · `HighlighterPanel` · `EraserPanel`** — each is a list of
  rows from `ToolPanelParts` plus its own tool-specific icons. They hold no
  chassis classes of their own.

`StrokePreview` draws its sample through `renderStrokes`, the same path the
page uses, so a preview cannot quietly disagree with what the pen does.
`PREVIEW_PAGE_FRACTION = 3` is how much of a page a preview strip stands
for; widths are scaled by it so a sample stays honest.

## Adding things

**A new tool option (a slider, a switch, a colour).** `penSettings.ts` for
the type and default → `useQuickNoteInk` to carry it → the panel to show it
with a row from `ToolPanelParts` → `handwritingService` options if the
engine must act on it. Give it a default that reproduces today's behaviour.

**A new tool.** Same path, plus a `SettingsType` of its own, a branch in the
editor's panel area, and a button in the toolbar.

**A new nib.** `nibs.ts` only: add the name to `InkNib`, the behaviour to
the pure functions, and the entry to `INK_NIBS` (pens) or
`HIGHLIGHTER_TIPS`. The renderer picks it up; nothing else changes. Add it
to `FLAT_NIBS` if it is direction-sensitive.

**Restyling.** `ToolPanelParts.tsx` for the panels, the component for the
screen. If a cosmetic change needs a file under `src/services/`, stop: that
is the warning sign this document exists for.

## What to be careful of

**`touch-action` is not pen-aware.** This is the one that has already cost a
working build. Setting `touch-action: pan-x pan-y` on a drawing surface to
allow scrolling makes the browser read a *stylus* drag as a scroll and
cancel the pointer stream mid-stroke — the user cannot write at all, and
nothing in a desktop browser reveals it. A drawing surface keeps
`touch-action: none`, and any scrolling or zooming is driven from the
pointer events instead. The note page does not scroll today; the parked
multi-page canvas is where this comes back.

The backend also claims the touch sequence (`preventDefault` on `touchstart`
and `touchmove`) whether or not stylus-only is on, because iOS WebKit
otherwise withholds a touch it has decided is its own gesture. That is
upstream behaviour; a scrolling note page will have to deal with it.

**Pressure is optional.** `points` may be `[x, y]` with no pressure — a
mouse, a finger, or a pen that doesn't report it. Every nib function takes a
missing pressure as an ordinary press, which draws the nominal width.

**Changing a shared signature is silent at runtime.** When `erase()` took
its mode positionally and gained an options object instead, a caller still
passing `'area'` positionally destructured to `undefined` and fell back to
whole-stroke erasing with no error. TypeScript catches this; a harness that
skips type-checking does not. Grep every caller.

## Checking a change

`pnpm test` and `pnpm lint` are the real gates (see
[testing.md](testing.md)). The notes feature's own unit tests live beside
the rest in `src/__tests__/`.

For UI work, [DESIGN.md](../DESIGN.md) applies as it does everywhere:
e-ink, dark mode, RTL, safe-area insets, and every new string through i18n.
`ToolPanelParts` already carries `eink-bordered` where a panel needs a
visible boundary — another reason to build panels from it.

Ink is worth checking on a device, because the things that break it —
pressure, palm rejection, how the browser reads a stylus drag — do not exist
in a desktop browser.
