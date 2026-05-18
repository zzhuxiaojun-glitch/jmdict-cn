// 解析 stephenmk/yomitan-jlpt-vocab term_meta_bank → 输出 vendor/jlpt-tags.json
//
// 用途：建立 surface (kanji|kana) → JLPT level 映射表，供后续 batch 分级使用
//
// 输入：vendor/jlpt-vocab/term_meta_bank_*.json
// 输出：vendor/jlpt-tags.json
//   {
//     "<surface>": [{ "reading": "<kana>", "level": "N5" }],
//     ...
//   }
//   （同一 surface 可能有多个 reading，所以 value 是数组）
//
// 运行：node scripts/apply-jlpt-tags.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC_DIR = path.join(ROOT, 'vendor/jlpt-vocab');
const OUT = path.join(ROOT, 'vendor/jlpt-tags.json');

const tags = {};
let totalRows = 0;
const levelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };

for (const f of fs.readdirSync(SRC_DIR)) {
  if (!f.startsWith('term_meta_bank_')) continue;
  const rows = JSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
  for (const [surface, kind, payload] of rows) {
    if (kind !== 'freq') continue;
    const reading = payload?.reading ?? null;
    const level = payload?.frequency?.displayValue ?? null;
    if (!level || !/^N[1-5]$/.test(level)) continue;
    if (!tags[surface]) tags[surface] = [];
    tags[surface].push({ reading, level });
    levelCounts[level]++;
    totalRows++;
  }
}

fs.writeFileSync(OUT, JSON.stringify(tags));
console.log(`✓ wrote ${OUT}`);
console.log(`  ${totalRows} entries · ${Object.keys(tags).length} unique surfaces`);
console.log(`  by level: ${JSON.stringify(levelCounts)}`);
