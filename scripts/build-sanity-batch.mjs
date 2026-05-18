// 构建 Phase 0 sanity batch（50 N5 词条 + Tatoeba 候选例句）
//
// 输入：
//   vendor/jlpt-tags.json           （apply-jlpt-tags.mjs 输出）
//   vendor/jmdict-eng-common-3.6.2.json
//   vendor/tatoeba-raw/{jpn-cmn_links,jpn_sentences,cmn_sentences}.tsv
//
// 输出：
//   _phase0/batch_001_src.json     （准备好喂给 subagent 的输入文件）
//
// 注意：本脚本是 P0 一次性产物。P1 之后用 split-batches.mjs 滚动跑全量。
//
// 运行：node scripts/build-sanity-batch.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, '_phase0');
const OUT_FILE = path.join(OUT_DIR, 'batch_001_src.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('[1/5] 加载 JLPT 标签...');
const jlptTags = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/jlpt-tags.json'), 'utf8'));
// 修复 (2026-05-18): 必须按 (surface, reading) 对匹配，否则同形不同读音的词会选错。
// 例：大勢 在 JLPT N5 表里指 おおぜい (人多)，但 JMdict 1414230 是 たいせい (大势)，
// 同形不同义。原始 surface-only 过滤会错选到 たいせい。
const n5SurfaceReadings = new Map(); // surface → Set<reading>
for (const [surface, entries] of Object.entries(jlptTags)) {
  for (const e of entries) {
    if (e.level !== 'N5') continue;
    if (!n5SurfaceReadings.has(surface)) n5SurfaceReadings.set(surface, new Set());
    n5SurfaceReadings.get(surface).add(e.reading);
  }
}
console.log(`  N5 surfaces: ${n5SurfaceReadings.size}`);

console.log('[2/5] 加载 JMdict common...');
const jm = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/jmdict-eng-common-3.6.2.json'), 'utf8'));
function matchesN5(entry) {
  // 路径 1：kanji 表面 × kana 读音 配对
  for (const k of entry.kanji) {
    const readings = n5SurfaceReadings.get(k.text);
    if (!readings) continue;
    for (const kn of entry.kana) {
      // JMdict 的 appliesToKanji 约束哪些 kanji 形可用该读音；'*' 或 缺省 = 全部适用
      const applies = !kn.appliesToKanji
        || kn.appliesToKanji.length === 0
        || kn.appliesToKanji.includes('*')
        || kn.appliesToKanji.includes(k.text);
      if (applies && readings.has(kn.text)) return true;
    }
  }
  // 路径 2：kana-only 词条（JLPT surface = reading）
  if (entry.kanji.length === 0) {
    for (const kn of entry.kana) {
      const readings = n5SurfaceReadings.get(kn.text);
      if (readings && readings.has(kn.text)) return true;
    }
  }
  return false;
}
const n5Entries = jm.words.filter(matchesN5);
console.log(`  JMdict N5-tagged entries (reading-matched): ${n5Entries.length}`);

console.log('[3/5] 加载 Tatoeba jpn↔cmn pair index...');
const links = fs.readFileSync(path.join(ROOT, 'vendor/tatoeba-raw/jpn-cmn_links.tsv'), 'utf8')
  .split('\n').filter(Boolean).map((l) => l.split('\t'));
const cmnByJpn = new Map();
for (const [j, c] of links) {
  if (!cmnByJpn.has(j)) cmnByJpn.set(j, []);
  cmnByJpn.get(j).push(c);
}
const jpnText = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'vendor/tatoeba-raw/jpn_sentences.tsv'), 'utf8').split('\n')) {
  const [id, , text] = line.split('\t');
  if (cmnByJpn.has(id)) jpnText.set(id, text);
}
const cmnText = new Map();
for (const line of fs.readFileSync(path.join(ROOT, 'vendor/tatoeba-raw/cmn_sentences.tsv'), 'utf8').split('\n')) {
  const [id, , text] = line.split('\t');
  cmnText.set(id, text);
}
console.log(`  jpn pair sentences loaded: ${jpnText.size}, cmn sentences loaded: ${cmnText.size}`);

console.log('[4/5] 按策略分层选 50 个 sanity 条目...');
// 分桶策略
function entryPrimaryPos(entry) {
  const pos = entry.sense?.[0]?.partOfSpeech?.[0] ?? '';
  if (/^v[15]/.test(pos)) return 'verb';
  if (pos === 'adj-i') return 'i-adj';
  if (pos === 'adj-na') return 'na-adj';
  if (pos === 'n' || pos === 'n-suf' || pos === 'n-pref') return 'noun';
  if (pos === 'adv' || pos === 'adv-to') return 'adv';
  return 'misc';
}
function primaryKanjiLen(entry) {
  if (entry.kanji.length > 0) return entry.kanji[0].text.length;
  return 0;
}

const buckets = {
  'noun-2char': [],
  'noun-3plus': [],
  'verb': [],
  'i-adj': [],
  'na-adj': [],
  'kana-only': [],
  'multi-sense': [], // ≥3 senses
  'misc': [],
};
for (const entry of n5Entries) {
  const pos = entryPrimaryPos(entry);
  const kanjiLen = primaryKanjiLen(entry);
  const senseCount = entry.sense.length;
  const isKanaOnly = entry.kanji.length === 0;

  if (senseCount >= 3) {
    buckets['multi-sense'].push(entry);
  } else if (isKanaOnly && (entry.kana[0]?.text?.length ?? 0) >= 2) {
    buckets['kana-only'].push(entry);
  } else if (pos === 'verb') {
    buckets['verb'].push(entry);
  } else if (pos === 'i-adj') {
    buckets['i-adj'].push(entry);
  } else if (pos === 'na-adj') {
    buckets['na-adj'].push(entry);
  } else if (pos === 'noun' && kanjiLen === 2) {
    buckets['noun-2char'].push(entry);
  } else if (pos === 'noun' && kanjiLen >= 3) {
    buckets['noun-3plus'].push(entry);
  } else {
    buckets['misc'].push(entry);
  }
}

console.log('  bucket counts:', Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])));

// 配额
const quota = {
  'noun-2char': 12,
  'noun-3plus': 6,
  'verb': 10,
  'i-adj': 5,
  'na-adj': 3,
  'kana-only': 5,
  'multi-sense': 5,
  'misc': 4,
};

// Deterministic seed
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260518);
function sample(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

const selected = [];
for (const [bucket, q] of Object.entries(quota)) {
  const picked = sample(buckets[bucket], Math.min(q, buckets[bucket].length));
  console.log(`  ${bucket}: picked ${picked.length}/${q}`);
  selected.push(...picked);
}
console.log(`  total selected: ${selected.length}`);

console.log('[5/5] 为每个条目加 Tatoeba 候选例句...');
function findTatoebaCandidates(entry, max = 5) {
  const surfaces = [...entry.kanji.map((k) => k.text), ...entry.kana.map((k) => k.text)];
  const hits = [];
  for (const [jId, text] of jpnText) {
    if (surfaces.some((s) => s.length >= 2 && text.includes(s))) {
      const cmnIds = cmnByJpn.get(jId) ?? [];
      const cmn = cmnIds.map((cId) => cmnText.get(cId)).find(Boolean) ?? '';
      if (cmn) {
        hits.push({ tatoeba_id: Number(jId), jp: text, zh: cmn });
        if (hits.length >= max * 3) break; // 限制扫描
      }
    }
  }
  // 偏好 10-30 char 长度
  hits.sort((a, b) => {
    const aDist = Math.abs(a.jp.length - 20);
    const bDist = Math.abs(b.jp.length - 20);
    return aDist - bDist;
  });
  return hits.slice(0, max);
}

const enriched = selected.map((entry) => {
  const surfaces = [...entry.kanji.map((k) => k.text), ...entry.kana.map((k) => k.text)];
  const matchedJlpt = surfaces.flatMap((s) => (jlptTags[s] ?? []).map((t) => ({ surface: s, ...t })));
  return {
    id: entry.id,
    kanji: entry.kanji,
    kana: entry.kana,
    jlpt: 'N5',
    jlpt_matches: matchedJlpt, // 用于调试
    senses_en: entry.sense.map((s) => ({
      pos: s.partOfSpeech ?? [],
      glosses: (s.gloss ?? []).map((g) => g.text),
      misc: s.misc ?? [],
      field: s.field ?? [],
      info: s.info ?? [],
    })),
    tatoeba_candidates: findTatoebaCandidates(entry, 3),
  };
});

const output = {
  dispatch: 'jmdict_cn_gen',
  batch_id: 'batch_001',
  target_level: 'N5',
  generated_at: new Date().toISOString(),
  source: {
    jmdict: 'jmdict-eng-common-3.6.2',
    jlpt_vocab: 'stephenmk/yomitan-jlpt-vocab@2025.08.01.0',
    tatoeba_snapshot: 'jpn-cmn 2026-05-09',
  },
  count: enriched.length,
  entries: enriched,
};

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
console.log(`\n✓ wrote ${OUT_FILE}`);
console.log(`  ${enriched.length} entries, ${enriched.filter((e) => e.tatoeba_candidates.length > 0).length} with tatoeba candidates`);
