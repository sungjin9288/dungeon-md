import { describe, expect, it } from 'vitest';
import { resolveQuestSpeakerVisual } from './QuestSpeakerView';

describe('resolveQuestSpeakerVisual', () => {
  it.each([
    ['도깨비 전사', 'monster-ritual-v2-dokkaebi_warrior'],
    ['구미호', 'monster-ritual-v2-gumiho_guardian'],
    ['저승사자', 'monster-ritual-v2-death_messenger'],
    ['산신령', 'monster-ritual-v2-mountain_spirit'],
    ['신선 도인', 'monster-ritual-v2-sage'],
  ])('selects the registered ritual art for exact speaker %s', (speaker, textureKey) => {
    expect(resolveQuestSpeakerVisual(speaker, '🙂', () => true)).toEqual({
      kind: 'image',
      textureKey,
    });
  });

  it('falls back to the sage legacy texture when ritual art is unavailable', () => {
    expect(resolveQuestSpeakerVisual(
      '신선 도인',
      '🧙',
      key => key === 'monster-ai-sage',
    )).toEqual({ kind: 'image', textureKey: 'monster-ai-sage' });
  });

  it('preserves the caller emoji when neither registered texture exists', () => {
    expect(resolveQuestSpeakerVisual('신선 도인', '🧙', () => false))
      .toEqual({ kind: 'emoji', emoji: '🧙' });
  });

  it.each(['신선 도인 ', '산신', '구미호 수호자', 'constructor', '__proto__'])(
    'does not fuzzy-match unknown speaker %s',
    speaker => {
      expect(resolveQuestSpeakerVisual(speaker, '❔', () => true))
        .toEqual({ kind: 'emoji', emoji: '❔' });
    },
  );
});
