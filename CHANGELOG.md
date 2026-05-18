# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to JLPT-leveled releases (`v0.1.0-N5` → `v0.2.0-N4` → ...).

## [v0.1.0-N5] - 2026-05-18

### Added

- **N5 level data** — `data/jmdict-cn-N5.json` (622 entries, 1.6 MB)
  - 中文释义（每个 sense 独立译）
  - 3-4 句日语例句 + 中文翻译，按词的语感分布（不限单一 JLPT 难度）
  - **73% 含 Tatoeba 真人例句**（CC BY 2.0 FR attribution via `tatoeba_id`）
  - **63% multi-sense** 词条（senses_zh 多义独立处理）
  - 来源 batches: batch_002..017，全部由 Claude Code subagent 在 Max plan token quota 下生成
- 元信息：`data/jmdict-cn-N5.meta.json`
- 数据处理脚本：
  - `scripts/apply-jlpt-tags.mjs` — 解析 stephenmk/yomitan-jlpt-vocab → surface/reading map
  - `scripts/build-sanity-batch.mjs` — P0 sanity batch builder
  - `scripts/split-batches.mjs` — 全 level 切 batch 输入
  - `scripts/merge-batch-outputs.mjs` — 归并 batch 输出到 data/

### Pipeline notes

- 全部生成在 Claude Code subagent 内运行，**未调用 Anthropic API**
- TEMPLATE.md v2 prompt 规则积累自 P0 sanity 实战教训：
  - 16: Calque 避坑（階段 ≠ 阶段；用 段階）
  - 17: 古义/罕用 sense 不出独立例句
  - 18: 重复 sense 合并 (senses_zh = null 占位)
  - 19: 多读音同形词以 entry.kana[0] 为主读音

### Known limitations (N5)

- 部分高频多义动词（如 `1352320 上げる` 25 sense / `1597040 立つ` 18 sense / `1597890 作る` 14 sense）
  例句仅覆盖核心义；其余 sense 在 `senses_zh` 翻译但未配独立例句
- 部分 entry 的 Tatoeba 候选因 surface substring 误命中（如「し」匹配到「しない」）被舍弃，
  这些 entry 仅有 3 句 LLM 例句

### Coverage statistics

- JLPT N5 vocab list (stephenmk 2025.08.01.0): 705 entries
- After (surface, reading) match against JMdict common: **622 entries** (88%)
- 13% mismatch 因 JLPT surface 在 JMdict 不存在 / reading 不一致 — 留待后续修补

## [unreleased] (planned)

- `v0.2.0-N4` — ~565 entries (estimated)
- `v0.3.0-N3` — ~1,490 entries (estimated)
- `v0.4.0-N2` — ~1,633 entries (estimated)
- `v0.5.0-N1` — ~2,828 entries (estimated)
- `v0.6.0-untagged` — ~15,400 entries (estimated; JLPT 表外，含外来语 / 专业词 / 口语词)
