# Attribution

`jmdict-cn` 是基于多个上游开源资源构建的衍生作品。我们感谢以下项目和它们的维护者：

## JMdict — 词条结构与英文释义
- 项目: [Electronic Dictionary Research and Development Group (EDRDG)](http://www.edrdg.org/jmdict/edict.html)
- 简化版: [scriptin/jmdict-simplified](https://github.com/scriptin/jmdict-simplified) (CC BY-SA 4.0)
- 用途: 词条 ID、kanji/kana 表面形、词性标签、英文 sense glosses
- License: CC BY-SA 4.0

## stephenmk/yomitan-jlpt-vocab — JLPT 等级标签
- 项目: [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab)
- 上游数据: Jonathan Waller's JLPT Resources (CC BY)
- 用途: 词条的 N1-N5 等级标注
- License: CC BY-SA 4.0

## Tatoeba — 真人例句
- 项目: [Tatoeba Project](https://tatoeba.org/)
- 数据: 日中 (jpn↔cmn) 句对（约 15,000 对）
- 用途: 标记 `source: "tatoeba"` 的例句，每条保留 `tatoeba_id` 用于追溯原文
- 引用链接: `https://tatoeba.org/sentences/show/{tatoeba_id}`
- License: CC BY 2.0 FR

## Claude (by Anthropic) — 中文释义与例句生成
- 工具: Claude Code (Claude Opus / Sonnet) 通过 subagent dispatch 生成
- 输出: 每个 sense 的中文释义、3 句符合目标 JLPT 等级的日语例句及中文翻译
- 我们的产出（中文释义、LLM 例句、本仓库结构）以 **CC BY-SA 4.0** 发布

## 不包含的资源（仅本地参考，未入仓）

为了避免版权问题，以下商业辞典数据**不会**出现在本仓库的任何 commit、release 或分支中：

- 小学館『中日辞典 第3版』 — 仅作为生成质量的内部 QA 抽检 baseline 在贡献者本地使用，不被 LLM prompt 引用，不会出现在生成产物中。
- 沪江小 D、白水社中国語辞典 等其他商业资源 — 同上。

如果你发现仓库内有任何疑似侵权数据，请通过 GitHub issue 联系仓库维护者。

---

License 矩阵汇总：

| 输入 | 原 License | 我们的输出 License |
|---|---|---|
| JMdict 结构 + 英文 glosses | CC BY-SA 4.0 | CC BY-SA 4.0 |
| stephenmk JLPT 标签 | CC BY-SA 4.0 (wraps CC BY Waller) | CC BY-SA 4.0 |
| Tatoeba 例句 (含 `tatoeba_id`) | CC BY 2.0 FR | CC BY-SA 4.0 (with attribution preserved) |
| LLM 生成中文释义 + 例句 | (新原创) | CC BY-SA 4.0 |

整个 jmdict-cn 数据按 **CC BY-SA 4.0** 发布，含商用、再分发、改编权，需保留 attribution 并以相同 license 分享衍生作品。
