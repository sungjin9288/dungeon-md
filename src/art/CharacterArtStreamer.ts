/**
 * On-demand streaming of ritual-v2 character art.
 *
 * BootScene used to preload every registered 512×512 RGBA cutout. With nine it
 * already pushed the matched boot from ~0.6–1.1s to ~2.4–3.8s
 * (tools/character-b1-boot-matched.json); the full 136 would also hold about
 * 140 MB of decoded texture. Nothing needs them at boot: every consumer
 * (PortraitGenerator portraits, room tokens, world sprites, speakers) already
 * falls back to the legacy JPEG or procedural art and caches per version, so a
 * cutout that arrives later simply wins on the next render.
 *
 * Screens request the ids they show; the streamer loads at most two at a time,
 * never twice, and tells listeners when one lands so a screen can redraw.
 */
import type Phaser from 'phaser';
import { getCharacterArt } from '../data/characterArt';
import { logger } from '../utils/logger';

/** Loads one image URL; resolves with something the texture manager accepts. */
export type ArtImageLoader = (path: string) => Promise<HTMLImageElement>;

export interface ArtTextureSink {
  exists(key: string): boolean;
  addImage(key: string, image: HTMLImageElement): void;
}

export const CHARACTER_ART_CONCURRENCY = 2;

export class CharacterArtStreamer {
  private readonly queue: string[] = [];
  private readonly pending = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly listeners = new Set<(monsterId: string) => void>();
  private active = 0;

  constructor(
    private readonly sink: ArtTextureSink,
    private readonly load: ArtImageLoader,
    private readonly concurrency = CHARACTER_ART_CONCURRENCY,
  ) {}

  /** Queue the cutouts for `ids` that have art, are not loaded and not already queued. */
  request(ids: Iterable<string>): void {
    for (const id of ids) {
      const art = getCharacterArt(id);
      if (!art || this.sink.exists(art.textureKey) || this.pending.has(id) || this.failed.has(id)) continue;
      this.pending.add(id);
      this.queue.push(id);
    }
    this.pump();
  }

  /** Subscribe to arrivals; returns an unsubscribe function (call it on scene shutdown). */
  onLoaded(listener: (monsterId: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  isPending(id: string): boolean {
    return this.pending.has(id);
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const art = getCharacterArt(id);
      if (!art) { this.pending.delete(id); continue; }
      this.active += 1;
      this.load(art.path)
        .then(image => {
          if (!this.sink.exists(art.textureKey)) this.sink.addImage(art.textureKey, image);
          this.pending.delete(id);
          this.listeners.forEach(listener => listener(id));
        })
        .catch((error: unknown) => {
          // Keep the legacy art; do not retry in a loop.
          this.pending.delete(id);
          this.failed.add(id);
          logger.warn(`[ART] ritual-v2 load failed for ${id}`, error);
        })
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

function loadImageElement(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image load failed: ${path}`));
    image.src = path;
  });
}

const streamers = new WeakMap<Phaser.Game, CharacterArtStreamer>();

/** The game-wide streamer (texture manager is game-global, so is the queue). */
export function getCharacterArtStreamer(game: Phaser.Game): CharacterArtStreamer {
  let streamer = streamers.get(game);
  if (!streamer) {
    streamer = new CharacterArtStreamer({
      exists: key => game.textures.exists(key),
      addImage: (key, image) => { game.textures.addImage(key, image); },
    }, loadImageElement);
    streamers.set(game, streamer);
  }
  return streamer;
}
