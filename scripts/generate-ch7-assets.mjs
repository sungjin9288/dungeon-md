/**
 * Ch7 에셋 자동 생성 스크립트
 *
 * 사용법:
 *   OPENAI_API_KEY=sk-... node scripts/generate-ch7-assets.mjs
 *
 * - OpenAI DALL-E 3 API 사용
 * - 생성 후 public/assets/monsters/ + public/assets/invaders/ 에 저장
 * - 이미 존재하는 파일은 건너뜀 (--force 플래그로 덮어쓰기 가능)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FORCE          = process.argv.includes('--force');

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY 환경변수가 필요합니다.');
  console.error('   export OPENAI_API_KEY=sk-...');
  process.exit(1);
}

// ── 생성 대상 ─────────────────────────────────────────────────────────────────

const BASE_STYLE = `Korean mythological fantasy style, chibi character design,
clean digital art, vivid colors, white background, centered composition,
square format 256x256, high quality game asset sprite`;

const MONSTERS = [
  {
    id: 'celestial_guardian',
    prompt: `Celestial guardian warrior in golden heavenly armor with divine halo,
shield with sun emblem, noble expression, ${BASE_STYLE}`,
  },
  {
    id: 'sky_archer',
    prompt: `Sky archer with ethereal blue bow made of light, feathered wings, white hair,
targeting pose, divine archer from heavenly realm, ${BASE_STYLE}`,
  },
  {
    id: 'heaven_mage',
    prompt: `Heaven mage with starlight staff emitting golden sparks, flowing white and gold robes,
crescent moon hat, celestial spellcaster, ${BASE_STYLE}`,
  },
  {
    id: 'solar_warrior',
    prompt: `Solar warrior in radiant sun-themed armor, flaming sword, orange and gold palette,
sunburst motif on breastplate, divine solar knight, ${BASE_STYLE}`,
  },
  {
    id: 'divine_healer',
    prompt: `Divine healer with gentle smile, white and pink robes with lotus motif,
healing orb floating in hand, soft golden aura, celestial medic, ${BASE_STYLE}`,
  },
  {
    id: 'starlight_knight',
    prompt: `Starlight knight in midnight blue armor with constellation patterns,
star-shaped shoulder guards, dual silver swords, ${BASE_STYLE}`,
  },
  {
    id: 'celestial_sage',
    prompt: `Celestial sage elder with long white beard, wide-brimmed hat with stars,
ancient scroll, deep blue robes with celestial map patterns, wise expression, ${BASE_STYLE}`,
  },
  {
    id: 'god_realm_general',
    prompt: `God realm general in elaborate heavenly armor with dragon and phoenix motifs,
golden war flag, commanding pose, senior commander of celestial army, ${BASE_STYLE}`,
  },
];

const INVADERS = [
  {
    id: 'celestial_knight',
    prompt: `Celestial knight invader in shining golden armor with small angel wings,
divine shield, silver lance, heaven soldier, ${BASE_STYLE}`,
  },
  {
    id: 'divine_archer',
    prompt: `Divine archer invader with glowing bow of light, translucent feathered wings,
silver quiver, swift and elegant, ${BASE_STYLE}`,
  },
  {
    id: 'heaven_general',
    prompt: `Heaven general invader in heavy gold armor carrying a divine battle banner,
imposing war commander from the heavens, ${BASE_STYLE}`,
  },
  {
    id: 'sky_titan',
    prompt: `Sky titan invader, massive figure with cloud motifs on deep blue armor,
gigantic physique, storms in background, colossal heavenly warrior, ${BASE_STYLE}`,
  },
  {
    id: 'radiant_seraph',
    prompt: `Radiant seraph invader with six glowing wings arranged like a halo,
brilliant white and gold, divine light emanating, ethereal seraph angel, ${BASE_STYLE}`,
  },
  {
    id: 'celestial_dragon',
    prompt: `Celestial dragon mini-boss, East Asian dragon design with heavenly cloud patterns,
blue and gold scales, pearl glowing under chin, majestic flying pose, ${BASE_STYLE}`,
  },
  {
    id: 'god_emperor',
    prompt: `God Emperor final boss, majestic divine emperor with ornate multi-layered gold armor,
crown of stars, flowing divine robes, aura of absolute power, largest most impressive character,
${BASE_STYLE}`,
  },
];

// ── DALL-E 3 API 호출 ─────────────────────────────────────────────────────────

async function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:   'dall-e-3',
      prompt,
      n:       1,
      size:    '1024x1024',
      quality: 'standard',
      response_format: 'url',
    });

    const options = {
      hostname: 'api.openai.com',
      path:     '/v1/images/generations',
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
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
            reject(new Error(`OpenAI 오류: ${parsed.error.message}`));
          } else {
            resolve(parsed.data[0].url);
          }
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

async function downloadAndSave(url, destPath) {
  return new Promise((resolve, reject) => {
    // Follow redirects
    const download = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          download(res.headers.location);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(destPath, buf);
          resolve();
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    download(url);
  });
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
      const imageUrl = await generateImage(target.prompt);
      await downloadAndSave(imageUrl, destPath);
      console.log('✅ 저장됨');
      generated++;

      // Rate limit: 1 req/5초 (DALL-E 3 free tier 기준)
      if (generated < allTargets.length) {
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      console.log(`❌ 실패: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n완료: ✅ ${generated}개 생성 | ⏭ ${skipped}개 건너뜀 | ❌ ${failed}개 실패`);
}

run().catch(console.error);
