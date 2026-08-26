import type { ElementId, MonsterDef, TribeId } from './monstersTypes';

export type MonsterRole = MonsterDef['type'];

export interface MonsterVisualIdentity {
  readonly color: number;
  readonly glyph: string;
  readonly silhouetteCue: string;
  readonly motif: string;
}

export interface ResolvedMonsterVisualIdentity {
  readonly tribe: MonsterVisualIdentity;
  readonly role: MonsterVisualIdentity;
  readonly element: MonsterVisualIdentity;
}

const FALLBACK_TRIBE_IDENTITY: MonsterVisualIdentity = Object.freeze({
  color: 0x66717b,
  glyph: '◇',
  silhouetteCue: 'balanced rounded outline',
  motif: 'weathered stone token',
});

const FALLBACK_ROLE_IDENTITY: MonsterVisualIdentity = Object.freeze({
  color: 0x8a949c,
  glyph: '•',
  silhouetteCue: 'balanced stance',
  motif: 'neutral duty mark',
});

const FALLBACK_ELEMENT_IDENTITY: MonsterVisualIdentity = Object.freeze({
  color: 0x82909a,
  glyph: '○',
  silhouetteCue: 'soft rim light',
  motif: 'unattuned ember',
});

export const TRIBE_VISUAL_IDENTITIES: Readonly<Record<TribeId, MonsterVisualIdentity>> = Object.freeze({
  dokkaebi: Object.freeze({ color: 0xbf6b2d, glyph: '◇', silhouetteCue: 'horned head and club-like asymmetry', motif: 'brass bell and roof-tile curl' }),
  gumiho: Object.freeze({ color: 0xd56d8c, glyph: '◒', silhouetteCue: 'flowing tail fan and narrow ears', motif: 'foxfire ribbon' }),
  dragon: Object.freeze({ color: 0x4c9c6d, glyph: '≋', silhouetteCue: 'long crest and scaled mass', motif: 'jade scale and cloud curl' }),
  underworld: Object.freeze({ color: 0x7555a6, glyph: '✦', silhouetteCue: 'hooded taper and spectral gap', motif: 'spirit lantern and smoke trail' }),
  sansin: Object.freeze({ color: 0x7da64c, glyph: '⌁', silhouetteCue: 'broad shoulder and pine-like crown', motif: 'pine needle and mountain stone' }),
  sea: Object.freeze({ color: 0x3f8fb1, glyph: '≈', silhouetteCue: 'fin or wave sweep', motif: 'tide knot and shell line' }),
  mask: Object.freeze({ color: 0xc87542, glyph: '◉', silhouetteCue: 'face plate with wide eye voids', motif: 'painted mask and tassel' }),
  moonlight: Object.freeze({ color: 0x8e94d8, glyph: '☾', silhouetteCue: 'crescent negative space', motif: 'moon disc and starlight thread' }),
  celestial: Object.freeze({ color: 0xd5b654, glyph: '✧', silhouetteCue: 'tall haloed crown', motif: 'cloud braid and sun ray' }),
  primordial: Object.freeze({ color: 0x9a547d, glyph: '✹', silhouetteCue: 'uneven colossal mass', motif: 'cracked relic and ember vein' }),
  void: Object.freeze({ color: 0x7051b6, glyph: '◌', silhouetteCue: 'broken contour and inner void', motif: 'rift ring and dark crystal' }),
});

export const ROLE_VISUAL_IDENTITIES: Readonly<Record<MonsterRole, MonsterVisualIdentity>> = Object.freeze({
  melee: Object.freeze({ color: 0xd76d4f, glyph: '⚔', silhouetteCue: 'forward-wide stance', motif: 'guard blade' }),
  ranged: Object.freeze({ color: 0x58a6c9, glyph: '➹', silhouetteCue: 'tall narrow reach', motif: 'bow line' }),
  magic: Object.freeze({ color: 0x9b71d1, glyph: '✦', silhouetteCue: 'raised focus shape', motif: 'orbiting charm' }),
  support: Object.freeze({ color: 0x6dbf84, glyph: '+', silhouetteCue: 'open centered stance', motif: 'ward ribbon' }),
});

export const ELEMENT_VISUAL_IDENTITIES: Readonly<Record<ElementId, MonsterVisualIdentity>> = Object.freeze({
  fire: Object.freeze({ color: 0xe36a3a, glyph: '◆', silhouetteCue: 'warm lower rim', motif: 'ember fleck' }),
  frost: Object.freeze({ color: 0x75c5df, glyph: '✦', silhouetteCue: 'cool upper rim', motif: 'ice shard' }),
  lightning: Object.freeze({ color: 0xe3c54f, glyph: 'ϟ', silhouetteCue: 'sharp side flash', motif: 'forked spark' }),
  dark: Object.freeze({ color: 0x7655a4, glyph: '◐', silhouetteCue: 'violet shadow edge', motif: 'smoke curl' }),
  holy: Object.freeze({ color: 0xe7d58c, glyph: '✧', silhouetteCue: 'pale crown light', motif: 'sun thread' }),
});

function hasOwnIdentity(registry: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(registry, key);
}

export function getTribeVisualIdentity(tribe?: string): MonsterVisualIdentity {
  return tribe && hasOwnIdentity(TRIBE_VISUAL_IDENTITIES, tribe)
    ? TRIBE_VISUAL_IDENTITIES[tribe as TribeId]
    : FALLBACK_TRIBE_IDENTITY;
}

export function getRoleVisualIdentity(role?: string): MonsterVisualIdentity {
  return role && hasOwnIdentity(ROLE_VISUAL_IDENTITIES, role)
    ? ROLE_VISUAL_IDENTITIES[role as MonsterRole]
    : FALLBACK_ROLE_IDENTITY;
}

export function getElementVisualIdentity(element?: string): MonsterVisualIdentity {
  return element && hasOwnIdentity(ELEMENT_VISUAL_IDENTITIES, element)
    ? ELEMENT_VISUAL_IDENTITIES[element as ElementId]
    : FALLBACK_ELEMENT_IDENTITY;
}

export function getMonsterVisualIdentity(input: Pick<MonsterDef, 'tribe' | 'type' | 'element'>): ResolvedMonsterVisualIdentity {
  return {
    tribe: getTribeVisualIdentity(input.tribe),
    role: getRoleVisualIdentity(input.type),
    element: getElementVisualIdentity(input.element),
  };
}
