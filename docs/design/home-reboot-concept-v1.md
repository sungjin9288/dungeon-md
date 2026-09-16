# Home Design Reboot — Concept V1

> Superseded by `DESIGN.md` and `home-reboot-concept-v2.png`. Kept as design
> history; do not use this draft as the implementation target.

> Status: visual-direction draft for approval. Runtime color tokens remain owned by
> `src/constants/colors.ts`; this document does not introduce a second token source.

## Visual thesis

The Home screen is a living Korean-folklore dungeon viewed through its vertical
shaft. The illustrated world is the primary surface. UI appears as sparse,
weathered fixtures embedded into that world—not as a dashboard placed over it.

Primary reference: `public/assets/backgrounds/dokkaebi-lair-shaft.png`.

## Current defects to remove

- The 3×3 translucent card grid hides the architecture and destroys depth.
- Indigo panels, rounded cards, emoji, and the background belong to different
  visual languages.
- Room state, readiness, utility actions, and navigation all compete at the same
  visual weight.
- The oversized command deck repeats information already visible in the dungeon.

## Composition contract

1. **World first:** keep at least 65% of the illustrated shaft unobstructed.
2. **Architectural rooms:** anchor room hotspots to ledges/chambers. Use a small
   sigil, silhouette, short state label, and brass corner marks instead of a card grid.
3. **One next action:** show one blackened-brass action plate immediately above
   navigation. Keep it close to 56px high and bind it to the existing directive.
4. **Quiet HUD:** compress level and currencies into a thin soot-black top rail.
5. **Carved navigation:** use repository-native drawn sigils and short labels;
   preserve four 44px-or-larger hit areas without emoji.
6. **Narrative endpoint:** keep the dungeon heart visible as the route destination
   and use ember red only for threat/readiness state.

## Material and color roles

- World: teal-black stone and jade patina from the background.
- Structure: soot black, charcoal lacquer, aged iron.
- Interaction: oxidized brass and warm torch amber.
- Danger: restrained ember red.
- Text: warm parchment, never pure-white blocks.

## Forbidden patterns

- Generic blue/purple dashboard panels
- Opaque 3×3 card mosaics
- Emoji as production navigation icons
- Glassmorphism, neon glow, or pill soup
- Large duplicated status copy
- Borders around every region

## First implementation slice

Limit the first pass to the Home shell:

- `src/scenes/HomeBoardScenery.ts`
- `src/scenes/HomeRoomCards.ts`
- `src/scenes/HomeCommandDeck.ts`
- `src/ui/GameZoneNavigation.ts`
- Home-specific mappings in `src/constants/colors.ts` only if existing semantic
  roles cannot express the direction

Do not change `GameState`, progression, room transactions, navigation destinations,
or native projects in this slice.

## Acceptance criteria

- The real `dokkaebi-lair-shaft` background remains the dominant first read.
- The current actionable room and next action are identifiable within two seconds.
- Existing empty, built, locked, damaged, and focused room states remain distinct.
- Primary and navigation hit areas remain at least 44px high.
- No essential text is smaller than 10px at the 390×844 logical canvas.
- Home renders cleanly at 390×844 and on one iOS simulator capture with no overlap.

## Concept image caveat

`home-reboot-concept-v1.png` is a composition and material reference generated with
the built-in image tool from the repository background. Its generated labels,
numbers, and decorative details are not production content and must not be copied
into game state or assets without explicit review.
