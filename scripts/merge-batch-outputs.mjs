// 把多个 _output/batch_NNN_out.json 归并 + 与对应 src JSON join → data/jmdict-cn-<level>.json
//
// 用法：
//   node scripts/merge-batch-outputs.mjs \
//        --dispatch-dir /home/zzhuxiaojun/20260429_KimiStart/20260510_JLPTsimu_Codex/doc_jlptsimu/tasks/dispatches/jmdict_cn_gen \
//        --level N5 \
//        --batches 002,003,004,005,006,007,008,009,010,011,012,013,014,015,016 \
//        --known-bad-ids vendor/known-bad-ids.json   # 可选：排除已知坏 entry
//        --version v0.1.0-N5
//
// 输出：
//   data/jmdict-cn-<level>.json     （JSON 数组 of jmdict-cn entry schema，见 README §schema）
//   data/jmdict-cn-<level>.meta.json （元信息: 来源 batches / counts / known-bad）

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const DISPATCH_DIR = args['dispatch-dir'];
const LEVEL = args.level ?? 'N5';
const BATCHES = (args.batches ?? '').split(',').filter(Boolean);
const KNOWN_BAD_FILE = args['known-bad-ids'];
const VERSION = args.version ?? `v0.0.0-${LEVEL}`;

if (!DISPATCH_DIR || BATCHES.length === 0) {
  console.error('--dispatch-dir and --batches required');
  process.exit(1);
}

const OUT_SUBDIR = path.join(DISPATCH_DIR, '_output');
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

let knownBad = new Set();
if (KNOWN_BAD_FILE) {
  knownBad = new Set(JSON.parse(fs.readFileSync(KNOWN_BAD_FILE, 'utf8')).map(String));
  console.log(`[known-bad] excluding ${knownBad.size} entry IDs`);
}

const aggregated = [];
const batchStats = [];
for (const b of BATCHES) {
  const batchId = b.startsWith('batch_') ? b : `batch_${b.padStart(3, '0')}`;
  const srcPath = path.join(OUT_SUBDIR, `${batchId}_src.json`);
  const outPath = path.join(OUT_SUBDIR, `${batchId}_out.json`);
  if (!fs.existsSync(srcPath) || !fs.existsSync(outPath)) {
    console.warn(`  ✗ ${batchId}: missing src or out file, skip`);
    continue;
  }
  const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const srcById = new Map(src.entries.map((e) => [e.id, e]));

  let included = 0;
  let skipped = 0;
  for (const oe of out.entries) {
    if (knownBad.has(oe.id)) {
      skipped++;
      continue;
    }
    const se = srcById.get(oe.id);
    if (!se) {
      console.warn(`  ! ${batchId}/${oe.id}: src entry missing`);
      continue;
    }
    aggregated.push({
      id: se.id,
      kanji: se.kanji,
      kana: se.kana,
      jlpt: se.jlpt,
      senses_en: se.senses_en,
      senses_zh: oe.senses_zh,
      examples: oe.examples,
      provenance: {
        translated_at: out.completed_at ?? new Date().toISOString(),
        runner: 'claude-code-subagent',
        dispatch_id: `jmdict_cn_gen/${batchId}`,
        version: VERSION,
      },
    });
    included++;
  }
  batchStats.push({ batch_id: batchId, included, skipped });
  console.log(`  ✓ ${batchId}: ${included} included, ${skipped} skipped (known-bad)`);
}

console.log(`\n[total] ${aggregated.length} entries merged`);
const outFile = path.join(DATA_DIR, `jmdict-cn-${LEVEL}.json`);
const metaFile = path.join(DATA_DIR, `jmdict-cn-${LEVEL}.meta.json`);
fs.writeFileSync(outFile, JSON.stringify(aggregated, null, 2));
fs.writeFileSync(
  metaFile,
  JSON.stringify(
    {
      level: LEVEL,
      version: VERSION,
      entry_count: aggregated.length,
      generated_at: new Date().toISOString(),
      source_batches: batchStats,
      known_bad_excluded_count: knownBad.size,
    },
    null,
    2,
  ),
);
console.log(`✓ wrote ${outFile}`);
console.log(`✓ wrote ${metaFile}`);
