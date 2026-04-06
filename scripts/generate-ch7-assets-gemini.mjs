/**
 * Ch7 에셋 자동 생성 스크립트 (Google Gemini Imagen 3)
 *
 * 사용법:
 *   GEMINI_API_KEY=AIza... node scripts/generate-ch7-assets-gemini.mjs
 *
 * - Gemini Imagen 3 API 사용 (imagegeneration@006)
 * - public/assets/monsters/ + public/assets/invaders/ 에 저장
 * - 이미 존재하는 파일은 건너뜀 (--force 플래그로 덮어쓰기 가능)
 *
 * 참고: Vertex AI Imagen은 Google Cloud 프로젝트 필요
 *   대안으로 DALL-E 스크립트(generate-ch7-assets.mjs) 권장
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FORCE          = process.argv.includes('--force');

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY 환경변수가 필요합니다.');
  console.error('   export GEMINI_API_KEY=AIza...');
  process.exit(1);
}

const BASE_STYLE = `Korean mythological fantasy style, chibi character design,
clean digital art, vivid colors, white background, centered composition,
high quality game asset sprite, 256x256 pixels`;

const MONSTERS = [
  { id: 'celestial_guardian',  prompt: `Celestial guardian warrior in golden heavenly armor with divine halo, shield with sun emblem, ${BASE_STYLE}` },
  { id: 'sky_archer',          prompt: `Sky archer with ethereal blue bow of light, feathered wings, white hair, divine archer from heavenly realm, ${BASE_STYLE}` },
  { id: 'heaven_mage',         prompt: `Heaven mage with starlight staff, flowing white and gold robes, crescent moon hat, celestial spellcaster, ${BASE_STYLE}` },
  { id: 'solar_warrior',       prompt: `Solar warrior in radiant sun-themed armor, flaming sword, orange and gold palette, divine solar knight, ${BASE_STYLE}` },
  { id: 'divine_healer',       prompt: `Divine healer with gentle smile, white and pink lotus robes, healing orb in hand, soft golden aura, ${BASE_STYLE}` },
  { id: 'starlight_knight',    prompt: `Starlight knight in midnight blue armor with constellation patterns, star shoulder guards, dual silver swords, ${BASE_STYLE}` },
  { id: 'celestial_sage',      prompt: `Celestial sage elder with long white beard, wide hat with stars, ancient scroll, deep blue robes with celestial map, ${BASE_STYLE}` },
  { id: 'god_realm_general',   prompt: `God realm general in elaborate heavenly armor, dragon phoenix motifs, golden war flag, commanding celestial army general, ${BASE_STYLE}` },
];

const INVADERS = [
  { id: 'celestial_knight',  prompt: `Celestial knight invader in golden armor with small angel wings, divine shield, silver lance, heaven soldier, ${BASE_STYLE}` },
  { id: 'divine_archer',     prompt: `Divine archer invader with glowing light bow, translucent feathered wings, silver quiver, swift elegant, ${BASE_STYLE}` },
  { id: 'heaven_general',    prompt: `Heaven general invader in heavy gold armor with divine battle banner, imposing celestial war commander, ${BASE_STYLE}` },
  { id: 'sky_titan',         prompt: `Sky titan invader, massive figure with cloud motifs on deep blue armor, gigantic heavenly warrior, ${BASE_STYLE}` },
  { id: 'radiant_seraph',    prompt: `Radiant seraph with six glowing wings like a halo, brilliant white and gold, divine light, ethereal seraph angel, ${BASE_STYLE}` },
  { id: 'celestial_dragon',  prompt: `Celestial dragon, East Asian dragon with heavenly cloud patterns, blue and gold scales, pearl glowing, majestic flying pose, ${BASE_STYLE}` },
  { id: 'god_emperor',       prompt: `God Emperor in ornate multi-layered gold armor, crown of stars, flowing divine robes, aura of absolute power, ultimate boss character, ${BASE_STYLE}` },
];

// ── Gemini Imagen API 호출 ────────────────────────────────────────────────────
// Gemini 2.0 Flash experimental image generation endpoint

async function generateImageGemini(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const url = `/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path:     url,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`Gemini 오류: ${parsed.error.message}`));
            return;
          }
          // Extract inline image data
          const parts = parsed.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
          if (!imagePart) {
            reject(new Error('이미지 데이터 없음 — 응답: ' + JSON.stringify(parsed).slice(0, 200)));
            return;
          }
          resolve({
            data:     imagePart.inlineData.data,     // base64
            mimeType: imagePart.inlineData.mimeType,
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function saveBase64Image(base64Data, destPath) {
  const buf = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(destPath, buf);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function run() {
  const monstersDir = path.join(ROOT, 'public', 'assets', 'monsters');
  const invadersDir = path.join(ROOT, 'public', 'assets', 'invaders');

  const allTargets = [
    ...MONSTERS.map(m => ({ ...m, dir: monstersDir })),
    ...INVADERS.map(i => ({ ...i, dir: invadersDir })),
  ];

  let generated = 0;
  let skipped   = 0;
  let failed    = 0;

  for (const target of allTargets) {
    const destPath = path.join(target.dir, `${target.id}.jpg`);

    if (!FORCE && fs.existsSync(destPath)) {
      console.log(`⏭  ${target.id}.jpg — 이미 존재, 건너뜀`);
      skipped++;
      continue;
    }

    try {
      process.stdout.write(`🎨 생성 중: ${target.id} ... `);
      const result = await generateImageGemini(target.prompt);
      await saveBase64Image(result.data, destPath);
      console.log('✅ 저장됨');
      generated++;

      // Rate limit: 2초 간격
      if (generated + skipped < allTargets.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.log(`❌ 실패: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n완료: ✅ ${generated}개 생성 | ⏭ ${skipped}개 건너뜀 | ❌ ${failed}개 실패`);
}

run().catch(console.error);
