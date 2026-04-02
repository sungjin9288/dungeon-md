import type { DungeonTheme } from './DungeonTheme';
import { CAVE_THEME } from './caveTheme';
import { ICE_CAVE_THEME } from './iceCaveTheme';
import { LAVA_CAVE_THEME } from './lavaCaveTheme';
import { VOID_THRONE_THEME } from './voidTheme';

/** All registered dungeon themes — add future skins here */
const THEME_REGISTRY: Record<string, DungeonTheme> = {
  cave:         CAVE_THEME,
  ice_cave:     ICE_CAVE_THEME,
  lava_cave:    LAVA_CAVE_THEME,
  void_throne:  VOID_THRONE_THEME,
};

/** Ordered list for shop display */
export const ALL_THEMES: DungeonTheme[] = [CAVE_THEME, ICE_CAVE_THEME, LAVA_CAVE_THEME, VOID_THRONE_THEME];

/** Retrieve theme by id; falls back to cave if unknown */
export function getActiveTheme(themeId?: string): DungeonTheme {
  return THEME_REGISTRY[themeId ?? 'cave'] ?? CAVE_THEME;
}

export { CAVE_THEME };
export { ICE_CAVE_THEME } from './iceCaveTheme';
export { LAVA_CAVE_THEME } from './lavaCaveTheme';
export { VOID_THRONE_THEME } from './voidTheme';
export type { DungeonTheme };
