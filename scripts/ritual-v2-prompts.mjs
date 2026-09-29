#!/usr/bin/env node
/**
 * Ritual-v2 character prompt builder — single source of truth for new masters.
 *
 * A prompt = the approved style/composition block (PROMPTS.md dokkaebi_warrior)
 * + the tribe row of CHARACTER_ART_REVISION.md "11부족 확장 규칙"
 * + rarity/role rules from the same doc + one authored subject line per id
 * (scripts/ritual-v2-subjects.json). Only the subject is per character, so a
 * whole batch stays one set.
 *
 *   node scripts/ritual-v2-prompts.mjs --ids one_tail_fox,three_tail_fox [--out DIR]
 *   node scripts/ritual-v2-prompts.mjs --missing            # ids without a master PNG
 *
 * Writes {id}.txt (the full instruction for the image generator) into --out
 * (default output/character-art/ritual-v2/prompts) and prints the paths.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src/data');
const MASTER_DIR = join(ROOT, 'output/character-art/ritual-v2');
const SUBJECTS = JSON.parse(readFileSync(join(ROOT, 'scripts/ritual-v2-subjects.json'), 'utf8'));

const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const outDir = arg('--out') ?? join(MASTER_DIR, 'prompts');

// ── Monster metadata (same parsing as gen-art-brief.mjs) ─────────────────────
const field = (block, key) => block.match(new RegExp(`\\b${key}:\\s*'([^']+)'`))?.[1] ?? null;
const VALID_IDS = (() => {
  const t = readFileSync(join(DATA_DIR, 'monstersTypes.ts'), 'utf8');
  const m = t.match(/export type MonsterId\s*=\s*([\s\S]*?);/);
  return new Set(m ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]) : []);
})();
const monsters = new Map();
for (const file of readdirSync(DATA_DIR)) {
  if (!/^monstersData.*\.ts$/.test(file) || file.includes('.test.')) continue;
  const src = readFileSync(join(DATA_DIR, file), 'utf8');
  for (const m of src.matchAll(/\{[^{}]*\bid:\s*'([^']+)'[^{}]*\}/g)) {
    const id = m[1];
    if (monsters.has(id) || !VALID_IDS.has(id) || !field(m[0], 'name')) continue;
    monsters.set(id, {
      id, name: field(m[0], 'name'), type: field(m[0], 'type') ?? 'melee',
      tribe: field(m[0], 'tribe'), element: field(m[0], 'element') ?? '', rarity: field(m[0], 'rarityTier') ?? 'C',
    });
  }
}

// ── Rules (CHARACTER_ART_REVISION.md) ────────────────────────────────────────
const TRIBE = {
  dokkaebi:   ['squat heavy body, tile-curled horns, asymmetric club', 'baked clay, rope, worn wood, brass bell', 'identical horned human boys'],
  gumiho:     ['narrow ears, distinct authored tail count, sweeping fan', 'ivory fur, ink-indigo cloth, jade foxfire', 'identical dress with color swaps; anime woman wearing fox ears'],
  dragon:     ['long crest and coiled scaled mass', 'celadon, cloud braid, weathered bronze', 'winged western lizard defaults; Chinese imperial dragon'],
  underworld: ['tapering robe, broad gat, lantern negative space', 'ink cloth, paper lantern, pale jade smoke', 'skull/scythe-only costume shorthand'],
  sansin:     ['broad pine-crowned elder, mountain-like shoulders', 'bark, moss, stone, ochre cloth', 'ornamental hat as only distinction'],
  sea:        ['fins, shells, wave-shaped stance', 'nacre, wet stone, tide knots', 'generic mermaid silhouette for all'],
  mask:       ['carved expressive face plate, open dance stance', 'painted wood, tassels, hemp', 'borrowed historical mask traced exactly'],
  moonlight:  ['crescent contour, rabbit/tiger species shapes', 'ivory fur, muted silver, moon threads', 'human avatar for every animal'],
  celestial:  ['tall airy crown, cloud-sleeve silhouette', 'pale cloth, cloud braid, sun-brass', 'crowns and glow without role cues'],
  primordial: ['asymmetrical monumental mass', 'cracked relic stone, roots, ember seams', 'humanoid recolors of other tribes'],
  void:       ['broken contour, controlled inner gaps', 'ink glass, ash cloth, dark crystal', 'unreadable black blob / neon overload'],
};
const ROLE = {
  melee: 'Melee guardian: the silhouette owns weight and one readable weapon.',
  ranged: 'Ranged guardian: the silhouette owns reach — bow, sling or thrown tool held clearly.',
  magic: 'Magic guardian: the silhouette owns one focus shape (foxfire, orb, talisman or staff).',
  support: 'Support guardian: open, protective silhouette — arms or sleeves spread to shelter allies.',
};
const RARITY = {
  C: 'Common rank: humble working guardian, simple worn materials, no crown or jewelry.',
  U: 'Uncommon rank: slightly more crafted gear, one small authored ornament.',
  R: 'Rare rank: deliberate authored craft detail and a confident stance; still restrained, no crown.',
  E: 'Epic rank: larger presence and richer craft (lacquer, embroidery, bronze inlay) while the silhouette stays simple.',
  L: 'Legendary rank: monumental presence and the finest authored craft; majestic, never cluttered or glowing everywhere.',
};
const ELEMENT = {
  fire: 'warm ember accents', frost: 'pale frost-blue accents', lightning: 'small pale-gold lightning accents',
  dark: 'ink and dusky violet accents', holy: 'soft ivory-gold light accents', nature: 'moss and leaf-green accents',
  water: 'tide-blue accents', earth: 'ochre stone accents', wind: 'pale cloud-thread accents', void: 'dark crystal accents',
};

/** Full generator instruction for one monster id (throws on unknown id / missing subject). */
export function promptForId(id) {
  const m = monsters.get(id);
  if (!m) throw new Error(`unknown monster id: ${id}`);
  return buildPrompt(m);
}

export function tribeOf(id) {
  return monsters.get(id)?.tribe ?? null;
}

export function buildPrompt(m) {
  const subject = SUBJECTS[m.id];
  if (!subject) throw new Error(`no authored subject for ${m.id} in scripts/ritual-v2-subjects.json`);
  const [shape, material, avoid] = TRIBE[m.tribe] ?? ['one clear folk-spirit silhouette', 'matte folk craft materials', 'generic fantasy costume'];
  return `You are only an image generator for this task. Do NOT edit, create or delete any file other than the single output PNG named below. Do not run git. Do not change code.

Task: use your built-in image generation tool to create ONE image, then save the generated PNG unchanged (no resizing, no background removal, no repainting) to exactly this path, relative to the current directory:
  output/character-art/ritual-v2/${m.id}-master.png

The attached images are STYLE REFERENCES ONLY (approved characters of the same game): match their painterly gouache rendering, matte materials, deliberate silhouettes, charming 2.5-to-3-head collectible proportions and color discipline. Do not copy their bodies, props or costumes.

Image prompt:
Use case: stylized-concept. Asset type: one production full-body transparent character cutout for the SAME Korean folklore dungeon-defense collection game as the references, shown at 48 to 180 pixels tall.
Subject (${m.name}): ${subject}
Tribe language: main silhouette ${shape}; materials and motifs ${material}; avoid ${avoid}.
${ROLE[m.type] ?? ROLE.melee} ${RARITY[m.rarity] ?? RARITY.C}${ELEMENT[m.element] ? ` Element read through ${ELEMENT[m.element]} only.` : ''}
Style: original hand-painted stylized 2D gouache game illustration matching the references, broad matte brush planes, selective dry-brush texture, slightly irregular dark contour, warm readable face, soft ivory key light and restrained jade rim light. Charming and brave, not horror. Color discipline: charcoal and ink-indigo shadows, warm ochre/ivory faces, jade spirit light, aged brass accents. Not anime cel-shaded human, not glossy 3D toy, not photorealistic. No Chinese imperial costume or Chinese dragon, no Japanese kimono/samurai/oni motifs, no named-game copying.
Composition: square, one centered character, full body and every prop fully visible, occupies about 78 percent of the canvas with at least 10 percent empty margin on every side, front three-quarter view, silhouette readable at thumbnail size. Genuinely TRANSPARENT background with alpha. No environment, floor, cast shadow, white square, gradient backdrop, smoke background, text, letters, labels, UI, frame, badge, logo or watermark. Preserve clean transparency around fine edges.

When done, reply with only: the saved path, the image pixel size, and whether the PNG has an alpha channel.
`;
}

function main() {
  let ids;
  if (process.argv.includes('--missing')) {
    ids = [...monsters.keys()].filter(id => !existsSync(join(MASTER_DIR, `${id}-master.png`)));
  } else {
    ids = (arg('--ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
  }
  if (ids.length === 0) { console.error('usage: --ids a,b | --missing'); process.exit(1); }
  mkdirSync(outDir, { recursive: true });
  for (const id of ids) {
    const m = monsters.get(id);
    if (!m) { console.error(`unknown monster id: ${id}`); process.exitCode = 1; continue; }
    const path = join(outDir, `${id}.txt`);
    writeFileSync(path, buildPrompt(m));
    console.log(path);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
