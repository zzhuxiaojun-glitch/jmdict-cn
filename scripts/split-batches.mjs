// 把指定 JLPT level 的全量词条切成多个 batch 输入 JSON
//
// 用法：
//   node scripts/split-batches.mjs --level N5 --batch-size 40 \
//        --out-dir /home/zzhuxiaojun/20260429_KimiStart/20260510_JLPTsimu_Codex/doc_jlptsimu/tasks/dispatches/jmdict_cn_gen/_output \
//        --start-batch 2
//
// 输出：
//   {out-dir}/batch_NNN_src.json  （NNN 从 start-batch 开始编号，3 位补零）
//
// 注意：本脚本输出的 src JSON 给 subagent (TEMPLATE.md v2 prompt) 用。
//       reading-match 过滤已是基线行为（沿用 build-sanity-batch.mjs 的修复）。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// --- 解析参数 ---
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const LEVEL = args.level ?? 'N5';
const BATCH_SIZE = Number(args['batch-size'] ?? 40);
const OUT_DIR = args['out-dir'];
const START_BATCH = Number(args['start-batch'] ?? 1);
const EXCLUDE_IDS_FILE = args['exclude-ids']; // 可选：JSON 数组，跳过这些 entry IDs

if (!OUT_DIR) {
  console.error('--out-dir is required');
  process.exit(1);
}
if (!/^(N[1-5]|untagged)$/.test(LEVEL)) {
  console.error('--level must be N1..N5 or untagged');
  process.exit(1);
}

console.log(`[config] level=${LEVEL}  batch-size=${BATCH_SIZE}  out-dir=${OUT_DIR}  start-batch=${START_BATCH}`);

// --- 加载 JLPT 标签 ---
const jlptTags = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/jlpt-tags.json'), 'utf8'));

// 构建 surface→Set<reading> 映射；untagged 模式下收所有 N1-N5 已标记的 (surface,reading)
const surfaceReadings = new Map();
for (const [surface, entries] of Object.entries(jlptTags)) {
  for (const e of entries) {
    const include = LEVEL === 'untagged' ? /^N[1-5]$/.test(e.level) : e.level === LEVEL;
    if (!include) continue;
    if (!surfaceReadings.has(surface)) surfaceReadings.set(surface, new Set());
    surfaceReadings.get(surface).add(e.reading);
  }
}
console.log(`[jlpt] ${LEVEL === 'untagged' ? 'tagged surfaces (to exclude)' : LEVEL + ' unique surfaces'}: ${surfaceReadings.size}`);

// --- 加载 JMdict + reading-match 过滤 ---
const jm = JSON.parse(fs.readFileSync(path.join(ROOT, 'vendor/jmdict-eng-common-3.6.2.json'), 'utf8'));
function matchesAnyTaggedLevel(entry) {
  for (const k of entry.kanji) {
    const readings = surfaceReadings.get(k.text);
    if (!readings) continue;
    for (const kn of entry.kana) {
      const applies = !kn.appliesToKanji
        || kn.appliesToKanji.length === 0
        || kn.appliesToKanji.includes('*')
        || kn.appliesToKanji.includes(k.text);
      if (applies && readings.has(kn.text)) return true;
    }
  }
  if (entry.kanji.length === 0) {
    for (const kn of entry.kana) {
      const readings = surfaceReadings.get(kn.text);
      if (readings && readings.has(kn.text)) return true;
    }
  }
  return false;
}
const levelEntries = LEVEL === 'untagged'
  ? jm.words.filter((e) => !matchesAnyTaggedLevel(e))
  : jm.words.filter(matchesAnyTaggedLevel);
console.log(`[jmdict] ${LEVEL} ${LEVEL === 'untagged' ? 'untagged (no JLPT label)' : 'reading-matched'} entries: ${levelEntries.length}`);

// --- 排除指定 entry IDs（可选）---
let excluded = new Set();
if (EXCLUDE_IDS_FILE) {
  const ids = JSON.parse(fs.readFileSync(EXCLUDE_IDS_FILE, 'utf8'));
  excluded = new Set(ids.map(String));
  console.log(`[exclude] skipping ${excluded.size} IDs from ${EXCLUDE_IDS_FILE}`);
}
const finalEntries = levelEntries.filter((e) => !excluded.has(e.id));
console.log(`[final] entries to dispatch: ${finalEntries.length}`);

// --- 加载 Tatoeba pair 索引（一次性，跨 batch 复用）---
console.log('[tatoeba] loading...');
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
console.log(`[tatoeba] ${jpnText.size} jpn pair sentences indexed`);

function findTatoebaCandidates(entry, max = 3) {
  const surfaces = [...entry.kanji.map((k) => k.text), ...entry.kana.map((k) => k.text)]
    .filter((s) => s.length >= 2);
  if (surfaces.length === 0) return [];
  const hits = [];
  for (const [jId, text] of jpnText) {
    if (surfaces.some((s) => text.includes(s))) {
      const cmnIds = cmnByJpn.get(jId) ?? [];
      const cmn = cmnIds.map((cId) => cmnText.get(cId)).find(Boolean);
      if (cmn) {
        hits.push({ tatoeba_id: Number(jId), jp: text, zh: cmn });
        if (hits.length >= max * 3) break;
      }
    }
  }
  hits.sort((a, b) => Math.abs(a.jp.length - 20) - Math.abs(b.jp.length - 20));
  return hits.slice(0, max);
}

// --- 切 batch ---
fs.mkdirSync(OUT_DIR, { recursive: true });
const batches = [];
for (let i = 0; i < finalEntries.length; i += BATCH_SIZE) {
  batches.push(finalEntries.slice(i, i + BATCH_SIZE));
}
console.log(`[batches] count=${batches.length}, sizes=${batches.map((b) => b.length).join(',')}`);

console.log('[output] writing batch src files + collecting tatoeba candidates...');
const summary = [];
const startTs = Date.now();
for (let i = 0; i < batches.length; i++) {
  const batchNum = START_BATCH + i;
  const batchId = `batch_${String(batchNum).padStart(3, '0')}`;
  const batch = batches[i];

  const enriched = batch.map((entry) => {
    const matchedJlpt = LEVEL === 'untagged' ? [] : [
      ...entry.kanji.map((k) => k.text),
      ...entry.kana.map((k) => k.text),
    ].flatMap((s) =>
      (jlptTags[s] ?? [])
        .filter((t) => t.level === LEVEL)
        .map((t) => ({ surface: s, reading: t.reading, level: t.level })),
    );
    return {
      id: entry.id,
      kanji: entry.kanji,
      kana: entry.kana,
      jlpt: LEVEL,
      jlpt_matches: matchedJlpt,
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

  const outObj = {
    dispatch: 'jmdict_cn_gen',
    batch_id: batchId,
    target_level: LEVEL,
    generated_at: new Date().toISOString(),
    source: {
      jmdict: 'jmdict-eng-common-3.6.2',
      jlpt_vocab: 'stephenmk/yomitan-jlpt-vocab@2025.08.01.0',
      tatoeba_snapshot: 'jpn-cmn 2026-05-09',
    },
    count: enriched.length,
    entries: enriched,
  };

  const filePath = path.join(OUT_DIR, `${batchId}_src.json`);
  fs.writeFileSync(filePath, JSON.stringify(outObj));
  const tatHits = enriched.filter((e) => e.tatoeba_candidates.length > 0).length;
  summary.push({
    batch_id: batchId,
    entries: enriched.length,
    tatoeba_hits: tatHits,
    file: filePath,
  });
  console.log(`  ✓ ${batchId}: ${enriched.length} entries, ${tatHits} with tatoeba`);
}

console.log(`\n[done] wrote ${batches.length} batches in ${((Date.now() - startTs) / 1000).toFixed(1)}s`);
console.log('\n=== manifest entries (paste into manifest.json) ===\n');
for (const s of summary) {
  console.log(JSON.stringify({
    id: s.batch_id,
    summary: `${LEVEL} 词条第 ${Number(s.batch_id.split('_')[1])} 批（${s.entries} entries，${s.tatoeba_hits} 有 Tatoeba 候选）`,
    scope: [
      `src 路径：_output/${s.batch_id}_src.json`,
      `spawn subagent 按 TEMPLATE.md v2 prompt 跑 → _output/${s.batch_id}_out.json`,
      'validate / 主线肉眼抽 5-10 条复核',
      `写 status: doc_jlptsimu/tasks/status/jmdict_cn_gen_${s.batch_id}.json`,
    ],
    outputs: [
      `_output/${s.batch_id}_src.json`,
      `_output/${s.batch_id}_out.json`,
      `../../status/jmdict_cn_gen_${s.batch_id}.json`,
    ],
  }, null, 2) + ',');
}
