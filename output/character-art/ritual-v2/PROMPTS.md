# Ritual v2 character prompts

Built-in image generation, 2026-09-05. Legacy portraits were viewed as baseline,
not used as style references. New Dokkaebi is the style reference for later assets.
Master PNGs are copied unchanged from the tool output. Final runtime PNG export:
`node scripts/export-character-art.mjs`. This deterministic canvas export contains
the artwork inside 428×428 on a 512×512 transparent canvas (42px safe margin),
preserves alpha and checks the 512 KiB ceiling. It does not repaint or remove any
background. Initial 256px sips drafts were replaced after the 248px theatre render
showed softness at DPR 2; legacy JPG dimensions remain unchanged.

## dokkaebi_warrior

Source: `exec-e9876649-ff4e-4693-ade9-c8f3da46b100.png`.

```text
Use case: stylized-concept. Asset type: production-ready full-body character cutout for a Korean folklore dungeon-defense collection game, shown at 48 to 180 pixels tall. Create one ORIGINAL Dokkaebi warrior, a mischievous loyal guardian of an ancient mountain dungeon. NO reference to any named game or artist.
A squat powerful 2.5-head-tall clay-ochre goblin creature, broad expressive face with a crooked confident grin and two small tusks, dark eyebrows, short charcoal hair, two short asymmetrical horns shaped like weathered roof-tile curls. Clearly a nonhuman folk spirit, not a human boy wearing horns. Warm terracotta skin, large broad hands and bare sturdy feet. One oversized worn wooden pestle-club with a few dull bronze bands rests over the shoulder, angled compactly inside the square. Simple indigo hemp vest, rope belt, one aged brass bell and muted brick-red cloth knot. Common-rank working guardian, no crown, no jeweled armor. Stable wide melee stance; face and club readable in tiny thumbnail.
Hand-painted stylized 2D gouache game illustration: broad matte color planes, selective dry-brush texture, clean deliberate silhouette, slightly irregular dark contour, warm readable face, soft ivory key light and very restrained jade rim light. Charming, collectible, brave rather than horror. Color discipline: warm clay, charcoal/ink indigo, worn wood, aged brass. Not anime cel-shaded human, not glossy 3D toy, not photorealistic.
Composition: square, one centered character, full body and entire club visible, occupies about 78 percent of canvas, 10 percent empty margin, front three-quarter view, simple clear silhouette. Genuinely TRANSPARENT background with alpha. No environment, floor, cast shadow, white square, gradient backdrop, smoke background, text, letters, labels, UI, frame, badge, logo or watermark. Preserve useful transparency around fingers, horns and weapon.
```

## gumiho_guardian

Initial draft style reference: `dokkaebi_warrior-master.png` (rejected; see below).

```text
Use case: stylized-concept. Asset type: one production full-body transparent character cutout for the SAME Korean folklore dungeon-defense collection game as the reference. Input image is STYLE REFERENCE ONLY for painterly rendering, tactile materials, deliberate silhouettes and charming 2.5-to-3-head collectible proportions. Do not copy the goblin body, horns, club or costume.
Subject: original Gumiho guardian, a graceful alert fox-spirit spellcaster protecting a misty valley. Clearly a FOX CREATURE with expressive narrow muzzle, large pointed ears, amber eyes and ivory fur, not an anime woman wearing fox ears. Upright compact 3-head-tall body. Nine distinct broad ivory tails form a deliberate fan silhouette behind her, small jade foxfire tips, enough air to count/separate the main tails. One open hand cradles a small jade-white foxfire orb; other hand holds a folded old indigo silk fan. Short practical muted indigo jeogori jacket and deep dusky mulberry skirt-wrap with an asymmetric pale ochre knot, subtle worn brass charm. Reserved knowing smile, confident protective stance. Rare-tier, no elaborate queen crown or jewelry overload.
Style: original hand-painted stylized 2D gouache illustration matching the reference, broad matte brush planes, selective dry-brush edges, warm ivory face, restrained dark contour, tactile fur and cloth. Charming but ancient; color discipline ivory/ink indigo/dusty mulberry with small jade magic light. Soft ivory key light with muted jade rim. No named-game copying, glossy 3D toy, photorealism, human fashion avatar, horror or gore.
Square composition, single centered full-body character and all tails within frame, 10 percent transparent safe margin, readable large shapes at 48px. Genuinely transparent alpha background. No environment, floor, cast shadow, white square, gradient background, text, UI, frame, badge, logo or watermark.
```

## Rejected drafts and corrected Gumiho

Reference-based Gumiho outputs `exec-04607d5b-486f-4d9b-90b3-16a1c6a5feca.png`
and `exec-4c667cd1-d3d9-4b7f-8ea8-8ec98833d406.png` had baked checkerboards
(no alpha); neither was integrated. The second call requested background-only
alpha extraction but failed that gate. A new generation without an image input
produced the accepted source `exec-45a8a5f5-c8d6-4e2f-8937-e4e9f94d1ae4.png`.

```text
Create a TRANSPARENT PNG CUTOUT, not an image of a checkerboard. One original full-body fox-creature spellcaster for a Korean folklore dungeon-defense game. A compact charming 3-head-tall ivory Gumiho with nine large clearly separated tails, large pointed ears, expressive amber eyes and a fox muzzle. An ink-indigo short jeogori and dusty mulberry wrap skirt tied with a worn brass/ochre knot. One hand holds pale jade foxfire, the other a small indigo fan. Knowing protective smile. A fox creature, not a human woman. Hand-painted stylized2D gouache game illustration, matte broad brush planes and selective tactile fur/cloth wear, clean silhouette, warm readable ivory face; ancient folk-craft with collectible small-body proportions. No named-game or artist imitation. No glossy3D, photorealism or anime-human costume.
Square, centered entire character and nine tails, 10percent empty padding, safe uncropped edges. Empty pixels surrounding the character MUST have actual alpha transparency. No drawn checkerboard, no background color, no white square, no environment, floor, shadow, text, labels, UI, borders, logo or watermark.
```

## mountain_spirit

Accepted source: `exec-42fee205-81d2-4c47-92e7-ea323af99345.png`. No image input.

```text
Generate a new original production game character asset. Full-body stylized 2D hand-painted gouache Korean mountain spirit SANSHIN elder for a folklore dungeon-defense collection RPG. Genuinely TRANSPARENT background with actual alpha, empty surrounding pixels, absolutely no rendered checkerboard or floor.
An ancient but lovable small 2.5-head-tall elderly guardian with broad mountain-like shoulders, large kind wrinkled face, bushy ivory eyebrows, large cloudlike white beard, small knowing amber eyes and ochre weathered skin. His wide moss-green robe and layered natural pine-bark mantle create a squat triangular silhouette. Crooked pine-branch staff with a small carved jade bead, rope tie and an aged bronze bell. A tiny living pine sprig grows from his weathered stone-and-bark headdress; no broad gat (reserve gat for the underworld messenger). Hands open protectively rather than attacking. Support character, wise benevolent mountain ward, no other people or animal companions. Rich but restrained legendary craftsmanship: moss seams, carved wood and warm brass with no jewel overload. His character proportions MUST be compact, big-head and short-body like a handcrafted collectible goblin companion; NOT a tall realistic human.
Tactile broad brush planes, selective drybrush texture, matte cloth and bark, deliberate clean outer silhouette, soft warm ivory face lighting with restrained jade edge light. Charming expressive high-quality game illustration. Palette pine-green, charcoal-indigo, ivory beard and muted ochre/brass. Not photorealism, not glossy3D, not human anime costume, not a named artist or game imitation.
Square composition, one centered full character including staff, feet and crown entirely visible, occupies75-80percent of image with ample transparent margin. No background, checkerboard, smoke field, cast shadow, floor, scenery, text,UI,frame,badge,logo or watermark.
```

## death_messenger

The reference-based draft `exec-23bee5b3-8f50-4e11-aebc-c69fe9bfff8c.png` was rejected:
baked checkerboard and realistic long body. Accepted new source:
`exec-1c6f86e2-6a31-46b0-8dda-cb9400450341.png`. No image input.

```text
Create a TRANSPARENT PNG CUTOUT, NOT an image of a checkerboard. One original JEoseung-saja Korean underworld soul messenger for a folklore dungeon-defense collection game. A CHARMING 2.5-head-tall compact stylized guardian: a big pale ivory adult face occupying roughly one third of the complete character height, small short body, stubby arms, broad black Korean gat. This is a small collectible cartoon folklore spirit, NOT a realistic tall man. Gentle grave expression with expressive dark almond eyes and one lifted eyebrow, subtly pointed ears, no beard, no skeleton or skull.
A dark ink-indigo Korean dopo robe with broad worn sleeves and a rope belt carrying one aged bronze bell. One hand raises a square old paper lantern glowing pale jade, the other carries a folded wordless spirit ledger. The robe tapers into two small pale-jade spectral wisps instead of long legs. Strong inverted-triangle silhouette: broad hat, short wide shoulders, narrow robe hem. Calm reliable magical guide, not horror. Hat and lantern must be readable at 48px.
Original hand-painted stylized2D gouache game art, broad matte planes, selective drybrush cloth texture, clean deliberate silhouette, soft warm ivory face light, restrained jade rim and charcoal/steel-blue cloth highlights. Ancient handcrafted materials, friendly collectible proportions. No named-game imitation, glossy3D, photorealism, realistic adult body proportions, anime costume or elaborate jewels.
Square, centered entire character with hat/lantern/hem uncropped, ample transparent margins. Actual alpha-transparent empty pixels outside the cutout. Absolutely NO checkerboard, background color, white square, scenery, floor, cast shadow, background smoke, text,letters,UI,border,logo,watermark.
```
