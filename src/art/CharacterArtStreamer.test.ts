import { describe, expect, it, vi } from 'vitest';
import { CharacterArtStreamer, type ArtTextureSink } from './CharacterArtStreamer';

function harness(concurrency = 2) {
  const textures = new Set<string>();
  const sink: ArtTextureSink = { exists: k => textures.has(k), addImage: k => { textures.add(k); } };
  const resolvers: Array<{ path: string; ok: () => void; fail: () => void }> = [];
  const load = vi.fn((path: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    resolvers.push({ path, ok: () => resolve({} as HTMLImageElement), fail: () => reject(new Error('x')) });
  }));
  return { textures, streamer: new CharacterArtStreamer(sink, load, concurrency), load, resolvers };
}
const flush = () => new Promise(r => setTimeout(r, 0));

describe('CharacterArtStreamer (§37)', () => {
  it('loads only ids with ritual-v2 art, at most two at a time, and never twice', async () => {
    const h = harness();
    h.streamer.request(['dokkaebi_warrior', 'gumiho_guardian', 'sage', 'no_such_monster', 'dokkaebi_warrior']);
    expect(h.load).toHaveBeenCalledTimes(2);
    h.resolvers[0].ok(); await flush();
    expect(h.load).toHaveBeenCalledTimes(3);
    expect(h.textures.has('monster-ritual-v2-dokkaebi_warrior')).toBe(true);
    h.streamer.request(['dokkaebi_warrior']);
    expect(h.load).toHaveBeenCalledTimes(3);
  });

  it('notifies listeners on arrival and stops after unsubscribe', async () => {
    const h = harness();
    const seen: string[] = [];
    const off = h.streamer.onLoaded(id => seen.push(id));
    h.streamer.request(['sage']);
    h.resolvers[0].ok(); await flush();
    expect(seen).toEqual(['sage']);
    off();
    h.streamer.request(['dokkaebi_junior']);
    h.resolvers[1].ok(); await flush();
    expect(seen).toEqual(['sage']);
  });

  it('keeps legacy art on failure and does not retry the same id', async () => {
    const h = harness();
    h.streamer.request(['sage']);
    h.resolvers[0].fail(); await flush();
    expect(h.textures.size).toBe(0);
    h.streamer.request(['sage']);
    expect(h.load).toHaveBeenCalledTimes(1);
  });
});
