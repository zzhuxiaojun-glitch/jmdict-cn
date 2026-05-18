# jmdict-cn

**JMdict 中文化数据集** — 给中文母语日语学习者用的开源日中词典数据。

> JMdict ([scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified)) 原始数据**只有英文 gloss、无例句**。本项目在保留英文 gloss 的基础上为每个 common 词条补充：
>
> - **每个 sense 一条简洁中文释义**（大陆惯用语）
> - **3 句 LLM 生成的日语例句 + 中文翻译**，按词条 JLPT 等级自动定级（N5 词配 N5 简单句，N1 词配 N1-N2 长句）
> - 若 Tatoeba 命中再追加 1 句 **📖 真人例句**（CC BY attribution）
>
> 数据按 JLPT N5 → N1 分级发布，每完成一级 → GitHub release，学员可立即上手。

## 状态

| Release | 词条范围 | 词数（预估） | 状态 |
|---|---|---|---|
| `v0.0.0-sanity` | 50 条 N5 sanity | 50 | 🟡 进行中 |
| `v0.1.0-N5` | 全部 N5 | ~1,000 | 🔴 未开始 |
| `v0.2.0-N4` | 全部 N4 | ~2,000 | 🔴 未开始 |
| `v0.3.0-N3` | 全部 N3 | ~3,500 | 🔴 未开始 |
| `v0.4.0-N2` | 全部 N2 | ~5,500 | 🔴 未开始 |
| `v0.5.0-N1` | 全部 N1 | ~7,500 | 🔴 未开始 |
| `v0.6.0-untagged` | JLPT 表外 | ~3,000 | 🔴 未开始 |

## 数据 schema

每条 entry 形如：

```jsonc
{
  "id": "1577100",
  "kanji": [{ "text": "走る", "common": true }],
  "kana": [{ "text": "はしる", "common": true }],
  "jlpt": "N5",                        // 可能为 null（JLPT 表外）
  "senses_en": [                       // 来自 JMdict，不动
    { "pos": ["v5r","vi"], "glosses": ["to run"] },
    { "pos": ["v5r","vi"], "glosses": ["to operate","to manage"] }
  ],
  "senses_zh": [                       // 新增（LLM 生成）
    { "glosses": ["奔跑","跑步"], "context": "运动；快速移动" },
    { "glosses": ["运营","经营"], "context": "组织/事业层面" }
  ],
  "examples": [                        // 3-4 句
    { "jp": "毎朝公園を走っています。", "zh": "我每天早上在公园跑步。", "level": "N5", "source": "llm" },
    { "jp": "彼は会社を一人で走らせている。", "zh": "他一个人经营着这家公司。", "level": "N3", "source": "llm" },
    { "jp": "時間が走るように過ぎる。", "zh": "时间飞逝。", "level": "N2", "source": "llm" },
    { "jp": "彼女は道を走った。", "zh": "她在路上跑。", "level": "N5", "source": "tatoeba", "tatoeba_id": 123456 }
  ],
  "provenance": {
    "translated_at": "2026-05-25T12:34:56Z",
    "runner": "claude-code-subagent",
    "version": "v0.1.0-N5"
  }
}
```

完整 JSON Schema 在 [`schema/entry.schema.json`](schema/entry.schema.json)（待补）。

## 怎么用

### 浏览
- `data/jmdict-cn-N5.json` — N5 全量数据（JSON 数组）
- `data/jmdict-cn-all.json.gz` — 合并 gzip（待全部完工后发布）

### 在 Yomitan / 阅读器里用
本项目数据可以转换为 Yomitan 格式（待添加 `scripts/export-yomitan.mjs`）。

### 在自己的项目里用
直接 fetch GitHub release URL 或 clone 本仓库，按 [JSON Schema](schema/entry.schema.json) 加载即可。

## 怎么生成（贡献者）

调度逻辑**不在本仓库**，在主项目 [JLPTsimu](https://github.com/zzhuxiaojun-glitch/JLPTsimu_20260422)（private）的 `doc_jlptsimu/tasks/dispatches/jmdict_cn_gen/` 下，按现有 dispatch 框架跑：

1. `split-batches.mjs` 把 JMdict common 切成 30-50 条/批
2. Claude Code 主会话 spawn subagent 跑 batch
3. `merge-batch-outputs.mjs` 归并 subagent 输出
4. `validate.mjs` 校验
5. `qa-sample.mjs` 抽样对比小学館（小学館本地参考、不入仓）
6. PR + tag + GitHub release

**不调用 Anthropic API**，全部跑在维护者的 Claude Code Max plan token quota 下。

## License

[CC BY-SA 4.0](LICENSE) — 自由使用、修改、商用，需保留 attribution 并以相同 license 分享衍生作品。

上游 attribution 见 [ATTRIBUTION.md](ATTRIBUTION.md)。

---

**反馈 / 贡献**：通过 GitHub issue 或 PR。质量问题（释义不准、例句不自然）请贴具体 entry ID + 期望释义。
