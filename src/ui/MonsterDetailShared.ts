/**
 * MonsterDetailShared.ts — constants, types, and pure helpers shared
 * across MonsterDetailEquipment, MonsterDetailSkin, MonsterDetailGrowth,
 * and MonsterDetailPanel (the entry point). NO Phaser render logic here.
 */
import type Phaser from 'phaser';
import { summarizeStatEffects } from './ForgeShared';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { type GameState, type OwnedMonster, loadGameState } from '../data/wisdom';
import {
  MONSTER_DEFS,
  type OwnedMonsterProfile,
  type MonsterSkin,
  type RarityId,
} from '../data/monsters';
import {
  EQUIPMENT_DEFS, getEquipmentStats,
  xpToNextLevel,
  type SkillTree,
} from '../data/barracks';

// ─── Re-exported type ─────────────────────────────────────────────────────────

export type MonsterDetailTab = 'growth' | 'loadout' | 'appearance' | 'bond';

export interface MonsterDetailContext {
  scene: Phaser.Scene;
  focusSourceLabel?: string;
  onClose: () => void;
  /** Re-open after a commit; `tab` keeps the player on the tab they acted in. */
  onRefresh: (m: OwnedMonster, tab?: MonsterDetailTab) => void;
  onOpenForge?: (m: OwnedMonster) => void;
  onReturnToRoom?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DETAIL_PANEL_FILL = CASUAL.PANEL;
export const DETAIL_ROW_FILL   = CASUAL.PANEL_SOFT;
/** 초상화 디스크 — 크림 면 위 대비를 위한 살짝 깊은 따뜻한 톤 */
export const PORTRAIT_DISC_FILL = 0xe8c89a;
export const FEED_GOLD_COST    = 50;
export const FEED_XP_GAIN      = 20;
export const SHOP_PANEL_FILL       = CASUAL.PANEL;
export const SHOP_CARD_FILL        = CASUAL.PANEL;
export const SHOP_CARD_OWNED_FILL  = CASUAL.PANEL_SOFT;
export const SHOP_PURPLE           = CASUAL.PURPLE;
export const SHOP_PURPLE_DARK      = CASUAL.PURPLE_DK;
export const SHOP_OWNED_GREEN      = CASUAL.GREEN;

export const DETAIL_TYPE_LABEL: Record<string, string> = {
  melee:   '근접 수호자',
  ranged:  '원거리 수호자',
  magic:   '마법 수호자',
  support: '지원 수호자',
};

export const DETAIL_OWNED_RARITY_TO_TIER: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];

export const DETAIL_RARITY_META: Record<RarityId, { rank: number; label: string; stars: string; color: number; css: string }> = {
  C: { rank: 0, label: 'COMMON', stars: '★',     color: CASUAL.EDGE_SOFT, css: CASUAL_CSS.INK_SOFT },
  U: { rank: 1, label: 'UNIQUE', stars: '★★',    color: CASUAL.GREEN,     css: CASUAL_CSS.GREEN },
  R: { rank: 2, label: 'RARE',   stars: '★★★',   color: CASUAL.BLUE,      css: CASUAL_CSS.BLUE },
  E: { rank: 3, label: 'EPIC',   stars: '★★★★',  color: CASUAL.PURPLE,    css: CASUAL_CSS.PURPLE },
  L: { rank: 4, label: 'LEGEND', stars: '★★★★★', color: CASUAL.GOLD,      css: CASUAL_CSS.GOLD },
};

export const DETAIL_TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비',
  gumiho:   '구미호',
  dragon:   '용족',
  underworld: '저승',
  sansin:   '산신',
  sea:      '해신',
  mask:     '탈족',
  moonlight: '달빛',
  celestial: '천상',
};

export const DETAIL_ELEMENT_META: Record<string, { label: string; icon: string; color: number }> = {
  fire:      { label: '화염', icon: '🔥', color: CASUAL.RED },
  frost:     { label: '서리', icon: '❄',  color: CASUAL.BLUE },
  lightning: { label: '번개', icon: '⚡', color: CASUAL.GOLD },
  dark:      { label: '암흑', icon: '☾',  color: CASUAL.PURPLE },
  holy:      { label: '신성', icon: '✦',  color: CASUAL.GOLD },
};

export const DETAIL_EQUIPMENT_STARS = ['★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];

export const DETAIL_EQUIPMENT_TYPE_META: Record<string, { label: string; icon: string; color: number; css: string }> = {
  weapon:    { label: '무기',   icon: '⚔', color: CASUAL.GOLD,   css: CASUAL_CSS.GOLD },
  armor:     { label: '방어구', icon: '◆', color: CASUAL.BLUE,   css: CASUAL_CSS.BLUE },
  accessory: { label: '장신구', icon: '✦', color: CASUAL.PURPLE, css: CASUAL_CSS.PURPLE },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquipmentDisplay = {
  id: string;
  name: string;
  icon: string;
  type: string;
  desc: string;
  rarity: number;
  crafted: boolean;
};

export type GrowthDirective = {
  title: string;
  body: string;
  accent: number;
};

// ─── Pure helpers — collection meta ──────────────────────────────────────────

export function getDetailCollectionMeta(monster: OwnedMonster, def: OwnedMonsterProfile): {
  indexLabel: string;
  tier: RarityId;
  rank: number;
  label: string;
  stars: string;
  color: number;
  css: string;
  tribeLabel: string;
  elementLabel: string;
  elementIcon: string;
  elementColor: number;
} {
  const allIds = Object.keys(MONSTER_DEFS);
  const index  = def.registryId ? allIds.indexOf(def.registryId) : -1;
  const tier   = def.rarityTier ?? DETAIL_OWNED_RARITY_TO_TIER[monster.rarity ?? 0] ?? 'C';
  const rarity  = DETAIL_RARITY_META[tier];
  const element = def.element ? DETAIL_ELEMENT_META[def.element] : null;
  return {
    indexLabel:   index >= 0 ? `No.${String(index + 1).padStart(3, '0')}` : 'No.---',
    tier,
    rank:         rarity.rank,
    label:        rarity.label,
    stars:        rarity.stars,
    color:        rarity.color,
    css:          rarity.css,
    tribeLabel:   def.tribe ? DETAIL_TRIBE_LABELS[def.tribe] ?? '수호' : '수호',
    elementLabel: element?.label ?? '무속',
    elementIcon:  element?.icon ?? '◆',
    elementColor: element?.color ?? CASUAL.GOLD,
  };
}

// ─── Pure helpers — growth directive ─────────────────────────────────────────

export function getGrowthDirective(
  m: OwnedMonster,
  tree: SkillTree | undefined,
  gs: GameState,
  xpPct: number,
): GrowthDirective {
  const nextNode = tree?.nodes.find(node => {
    const spent     = (m.spentSkills[node.id] ?? 0) >= 1;
    const prereqMet = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
    return !spent && prereqMet && m.skillPoints >= node.cost;
  });
  if (nextNode) {
    return {
      title: '스킬 성장이 가능',
      body:  `${nextNode.icon} ${nextNode.name} 노드를 열어 전투 역할을 강화하세요.`,
      accent: CASUAL.PURPLE,
    };
  }
  if (xpPct >= 0.78 && m.level < 50) {
    return {
      title: '레벨업 임박',
      body:  '먹이로 경험치를 채우면 다음 던전 방 주력으로 쓰기 좋습니다.',
      accent: CASUAL.BLUE,
    };
  }
  if (!m.equipment && getEquipmentInventoryIds(gs).length > 0) {
    return {
      title: '장비 장착 추천',
      body:  '보유 장비를 장착하면 방어선 전투력이 바로 올라갑니다.',
      accent: CASUAL.GOLD,
    };
  }
  if ((m.equippedSkills ?? []).length < 2 && (gs.ownedActiveSkills ?? []).length > 0) {
    return {
      title: '액티브 스킬 장착',
      body:  '빈 스킬 슬롯을 눌러 웨이브 대응 옵션을 채우세요.',
      accent: CASUAL.BLUE,
    };
  }
  return {
    title: '던전 배치 준비',
    body:  '성장 상태가 안정적입니다. 전투실에 배치해 방어선을 강화하세요.',
    accent: CASUAL.GREEN,
  };
}

// ─── Pure helpers — feed/training preview ────────────────────────────────────

export function getFeedTrainingPreview(
  monster: OwnedMonster,
  state: GameState,
): {
  title: string;
  sub: string;
  chip: string;
  currentPct: number;
  nextPct: number;
  canAfford: boolean;
  willLevelUp: boolean;
  maxLevel: boolean;
} {
  const maxLevel   = monster.level >= 50;
  const xpNeeded   = xpToNextLevel(monster.level);
  const currentPct = maxLevel ? 1 : Math.min(1, monster.xp / xpNeeded);
  const nextXp     = monster.xp + FEED_XP_GAIN;
  const willLevelUp = !maxLevel && nextXp >= xpNeeded;
  const nextPct    = maxLevel ? 1 : willLevelUp ? 1 : Math.min(1, nextXp / xpNeeded);
  const canAfford  = (state.homeGold ?? 0) >= FEED_GOLD_COST;
  if (maxLevel) {
    return {
      title: '성장 완료',
      sub:   '장비와 배치로 전력 보강',
      chip:  'MAX',
      currentPct,
      nextPct,
      canAfford,
      willLevelUp: false,
      maxLevel,
    };
  }
  if (!canAfford) {
    return {
      title: '먹이 부족',
      sub:   `${FEED_GOLD_COST}골드 필요 · 보유 ${state.homeGold ?? 0}`,
      chip:  '부족',
      currentPct,
      nextPct: currentPct,
      canAfford,
      willLevelUp,
      maxLevel,
    };
  }
  return {
    title: willLevelUp ? '레벨업 훈련' : '먹이 주기',
    sub:   `${FEED_GOLD_COST}골드 · EXP +${FEED_XP_GAIN}`,
    chip:  willLevelUp ? 'Lv UP' : `${Math.round(nextPct * 100)}%`,
    currentPct,
    nextPct,
    canAfford,
    willLevelUp,
    maxLevel,
  };
}

// ─── Pure helpers — equipment ─────────────────────────────────────────────────

export function getEquipmentDisplay(gs: GameState, equipmentId: string): EquipmentDisplay | null {
  const staticDef = EQUIPMENT_DEFS.find(e => e.id === equipmentId);
  if (staticDef) {
    return {
      id:      staticDef.id,
      name:    staticDef.name,
      icon:    staticDef.icon,
      type:    staticDef.type,
      desc:    staticDef.desc,
      rarity:  0,
      crafted: false,
    };
  }

  const craftedDef = [...(gs.craftedEquipment ?? [])]
    .reverse()
    .find(equipment => equipment.id === equipmentId);
  if (!craftedDef) return null;

  return {
    id:      craftedDef.id,
    name:    craftedDef.name,
    icon:    craftedDef.emoji,
    type:    craftedDef.type,
    desc:    formatCraftedStatLine(getEquipmentStats(craftedDef.id) as Record<string, number>),
    rarity:  craftedDef.rarity,
    crafted: true,
  };
}

export function getEquipmentInventoryIds(gs: GameState): string[] {
  return Array.from(new Set([
    ...(gs.ownedEquipment ?? []),
    ...(gs.craftedEquipment ?? []).map(equipment => equipment.id),
  ]));
}

export function getEquipmentTypeMeta(type: string | undefined): { label: string; icon: string; color: number; css: string } {
  return DETAIL_EQUIPMENT_TYPE_META[type ?? ''] ?? { label: '장비', icon: '◇', color: CASUAL.EDGE_SOFT, css: CASUAL_CSS.INK_SOFT };
}

export function getEquipmentStars(rarity: number): string {
  const index = Math.max(0, Math.min(DETAIL_EQUIPMENT_STARS.length - 1, Math.floor(rarity)));
  return DETAIL_EQUIPMENT_STARS[index];
}

export function getEquipmentRarityColor(rarity: number): number {
  const palette = [CASUAL.EDGE_SOFT, CASUAL.GREEN, CASUAL.BLUE, CASUAL.PURPLE, CASUAL.GOLD, CASUAL.RED];
  const index   = Math.max(0, Math.min(palette.length - 1, Math.floor(rarity)));
  return palette[index];
}

export function getRecommendedEquipmentId(inventory: EquipmentDisplay[], equippedId: string | null | undefined): string | null {
  const candidates = inventory
    .filter(ed => ed.id !== equippedId)
    .sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (Number(b.crafted) !== Number(a.crafted)) return Number(b.crafted) - Number(a.crafted);
      return a.name.localeCompare(b.name);
    });
  return candidates[0]?.id ?? null;
}

export function getEquipmentImpactLabel(ed: EquipmentDisplay): string {
  const prefix = ed.crafted ? `제작 R${Math.max(1, ed.rarity + 1)}` : '기본';
  if (ed.type === 'weapon')    return `${prefix} · 공격 보정`;
  if (ed.type === 'armor')     return `${prefix} · 방 보강`;
  if (ed.type === 'accessory') return `${prefix} · 운영 보조`;
  return `${prefix} · 전력 보강`;
}

// ─── Pure helpers — label / stat formatting ───────────────────────────────────

export function shortenLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, Math.max(1, max - 1))}…` : label;
}

/** 44px equipment tile label: the last word names the item ("도깨비 방망이" → "방망이"). */
export function equipmentTileLabel(name: string): string {
  const words = name.trim().split(/\s+/);
  return shortenLabel(words[words.length - 1] ?? name, 4);
}

export function formatCraftedStatLine(stats: Record<string, number>): string {
  return summarizeStatEffects(stats, '제작 장비').join(' · ');
}

// ─── Pure helpers — skin rarity color ─────────────────────────────────────────

export function getSkinRarityColor(skin: MonsterSkin): number {
  if (skin.rarity === 'limited') return CASUAL.GOLD_DK;
  if (skin.rarity === 'rare')    return CASUAL.PURPLE_DK;
  return CASUAL.BLUE_DK;
}

// Keep loadGameState accessible from feature modules via a single import path
export { loadGameState };
