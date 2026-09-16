/**
 * Returns safe-area insets in game-canvas pixels.
 *
 * CSS env(safe-area-inset-*) values are in CSS pixels (device-independent).
 * Phaser's FIT scale mode renders the game at CANVAS_WIDTH×CANVAS_HEIGHT and
 * then scales the canvas element to fill the screen. We divide the CSS-pixel
 * inset by the Phaser display scale to get game-canvas pixels.
 *
 * Usage:
 *   import { getGameSafeArea } from '../constants/safeArea';
 *   const { top, bottom } = getGameSafeArea(this.scale.displayScale.x);
 */
export interface SafeArea {
  top:    number;
  bottom: number;
  left:   number;
  right:  number;
}

/**
 * WKWebView can report zero CSS env() insets while still drawing below the
 * iOS system bars. These portrait-only fallbacks match the two modern iPhone
 * safe-area families and retain a conservative classic-device status inset.
 */
export function getNativeSafeAreaFallback(platform: string, screenHeight: number): SafeArea {
  if (platform !== 'ios') return { top: 0, bottom: 0, left: 0, right: 0 };
  if (screenHeight >= 852) return { top: 59, bottom: 34, left: 0, right: 0 };
  if (screenHeight >= 812) return { top: 47, bottom: 34, left: 0, right: 0 };
  return { top: 20, bottom: 0, left: 0, right: 0 };
}

export function installNativeSafeAreaFallback(platform: string, screenHeight: number): SafeArea {
  const fallback = getNativeSafeAreaFallback(platform, screenHeight);
  const root = document.documentElement;
  root.style.setProperty('--native-safe-top', `${fallback.top}px`);
  root.style.setProperty('--native-safe-bottom', `${fallback.bottom}px`);
  return fallback;
}

/** Read CSS env() safe-area values (in CSS pixels) via the custom properties
 *  set on :root in index.html. */
function readCssSafeArea(): SafeArea {
  const style = getComputedStyle(document.documentElement);
  const parse = (prop: string) => parseFloat(style.getPropertyValue(prop)) || 0;
  return {
    top:    parse('--sat'),
    bottom: parse('--sab'),
    left:   parse('--sal'),
    right:  parse('--sar'),
  };
}

/**
 * @param displayScale  Phaser's `scene.scale.displayScale.x`
 *                      (how many CSS pixels = 1 game pixel).
 *                      Pass 1 if you want raw CSS pixel values.
 */
export function getGameSafeArea(displayScale = 1): SafeArea {
  const css = readCssSafeArea();
  const s   = displayScale > 0 ? displayScale : 1;
  return {
    top:    Math.ceil(css.top    / s),
    bottom: Math.ceil(css.bottom / s),
    left:   Math.ceil(css.left   / s),
    right:  Math.ceil(css.right  / s),
  };
}

/** Minimum sensible safe area for any modern phone (fallback when env() = 0). */
export const MIN_SAFE_TOP    = 0;   // let CSS env() drive it
export const MIN_SAFE_BOTTOM = 0;
