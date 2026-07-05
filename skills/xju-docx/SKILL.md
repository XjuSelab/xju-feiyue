---
name: xju-docx
description: 按《新疆大学本科毕业论文（设计）规范及格式要求》生成、规范化、校验、润色软件工程课程文档的 docx。适用文档类型：学年论文、毕业论文（设计）、工程项目开发综合实践报告、课程设计说明书、开题报告、需求/概要/详细设计说明书、测试报告，及其绪论/摘要/目录/参考文献/致谢/附录等部分。触发动作：生成论文框架、排版 docx、按新大规范/学校模板套格式、格式检查/校验、三线表、分节页码（罗马→阿拉伯）、页眉横线、目录域、读取或转换 Word97 老 .doc、润色定稿。用户原话变体也算："帮我把论文调成学校要求的样子""按学校格式排版""这篇 .doc 转成 docx""论文格式对不对""加个三线表""目录页码不对""字号/行距不符"。只要涉及新大规范下的论文/软工课程 docx 的生成、老 .doc 读取、格式校验或润色，一律触发本 skill。不适用：PDF、Excel、幻灯片、Google Docs，以及与新疆大学规范无关的通用 Word 排版或不涉及格式的纯内容写作。
---

# xju-docx — 新疆大学论文 docx 规范化工具链

把"新大规范排版"封装为三类脚本 + 一份规范速查。**动笔前先读速查，改完必跑机检。**
脚本负责机械/可复现的部分（提取、样式矫正、机检、自动修复），模型只做需要判断力的部分（内容组织、逐段润色）。

## Quick Reference（先按起点定路线）

| 你的起点 / 诉求 | 走哪条 | 命令 / 动作 |
|---|---|---|
| 从零要一份框架 docx | 步骤 A | `python3 scripts/build_framework.py -o out.docx --name 姓名 [--title ...]` |
| 手里是 Word97 老 `.doc` | 步骤 B → 再进 C | `python3 scripts/extract_doc.py old.doc > full.txt` |
| 已有 `.docx`/`.md` 草稿要规范化+润色 | 步骤 C | 读 `references/spec-digest.md` → `--fix` 机械矫正 → 逐段 Edit 润色 |
| 只想知道"合不合规" | 步骤 D | `python3 scripts/validate_docx.py file.docx [--framework] [--json]` |
| 类型/诉求说不清 | 先问用户 | 是新建还是改现有？哪种课程文档？目标是排版还是纯润色？ |

## 硬红线（非商量项，先读）

- **目录必须是 TOC 域**（`xju_format.add_toc`），生成后在 Word/WPS"更新域"才显示页码——**绝不手写假目录**。
- **页码分三节**：封面无页码 → 前置（声明/任务书/摘要/目录）罗马数字 → 正文起阿拉伯数字从 1 连续——**不手打页码**。
- **表一律三线表**（顶/底 1.5 磅、中线 1 磅），调 `three_line_table()`——**不手画边框**。
- **规模/实验数据一律来自项目事实源**（README/BACKEND_SPEC/docs），核实后再写，**绝不编造**。
- 学校下发的封面/任务书/评议书统一模板件，**以学校模板为准**，本 skill 产物只是排版占位。

## 产物与位置

- `references/spec-digest.md` — 规范速查（页面/页码/标题/图表公式/引用/文字细则），**权威参照，动笔前先读**。
- `scripts/xju_format.py` — python-docx 排版库：`SIZE` 字号字典、`setup_styles`（Heading 1-4 一键矫正）、`setup_section`/`set_pg_num`/`setup_header`/`setup_page_footer`（分节页码+页眉 0.5 磅横线）、`add_toc`（TOC 域）、`three_line_table`。
- `scripts/build_framework.py` — 框架生成器 CLI（封面+修改记录+目录+GB8567 九章骨架，每节带灰色【待填】指引）。
- `scripts/extract_doc.py` — Word97 `.doc` 文本提取器（olefile，免 LibreOffice；`\x07`→` | `、`\r`→换行）。
- `scripts/validate_docx.py` — 格式机检器：`--json` 结构化输出、`--fix` 自动修复机械项、`--content` 占位符残留门禁、`--framework` 三节页码结构检查。

**字号 mini 速查（高频，其余查 spec-digest）：** 正文小四=12 · 一级标题三号=16 · 二级小三=15 · 三级四号=14 · 图表题五号=10.5 · 页眉/脚注小五=9。

## 环境

`python3` + `python-docx` + `olefile`（均 pip 用户级可装，无需 sudo）。**不要**为读 `.doc` 去装 LibreOffice/antiword——用 `extract_doc.py`。

## 步骤

### A) 生成新框架文档
```bash
python3 scripts/build_framework.py -o 输出.docx --name 姓名 [--title 题目] [--college 学院] [--advisor 导师] [--header 页眉文字]
```
骨架在脚本 `STRUCT` 常量；换课程/毕业论文改 STRUCT 或复用 `xju_format` 另写生成器。默认 `--header` 为学年论文口径，毕业论文按规范改"新疆大学本科毕业论文(设计)"。

### B) 读取旧 `.doc`（二进制老格式）
```bash
python3 scripts/extract_doc.py 旧文件.doc > 全文.txt
```
表格单元格已转 ` | `；目录域以 `HYPERLINK … 标题→页码` 出现，可 `grep -o 'HYPERLINK[^\t]*\t[0-9]*'` 提目录树。**注意：纯文本提取会丢表格结构、图片、上标引用角标**——迁入新框架后按「常见踩坑」补回。

### C) 规范化 / 润色既有 docx —— 分清脚本与 Edit 的边界
1. 读 `references/spec-digest.md`，逐项对照找偏差（字号/行距/页码分段/三线表/图表编号/引用标注）。
2. **格式偏差先自动修**：`python3 scripts/validate_docx.py 文件.docx --fix [--framework]` 一次性矫正样式/页面/updateFields（含页码分节，需 --framework）；剩余"需人工确认"项按输出清单用 `xju_format` 库函数逐项处理。
   ```
   ❌ 手打三线表边框 / 手写页码 / 手敲假目录
   ✅ three_line_table() / set_pg_num() / add_toc()（TOC 域）
   ```
3. **内容润色用 Edit 工具逐段改**（模型判断力的活）：遵文字细则（缩写首现注中文、统计数字用阿拉伯数字、单位统一、上角标实引 [1]），对照项目事实源核实。
   ```
   ❌ 写脚本批量正则替换正文关键词 —— 会误伤引用角标、专有名词、GB/T 7714 著录
   ✅ 逐段读、逐段 Edit 改；改动前后对照原意
   ```

### D) 校验回路（每次改完必跑，按顺序，别跳）

**CRITICAL：不要改完就交付。必须机检→修复→复跑，直到全绿。**

```bash
python3 scripts/validate_docx.py 文件.docx [--framework]     # 格式机检（25+ 项）
python3 scripts/validate_docx.py 文件.docx --content         # 定稿前：占位符残留门禁（【待填】/lorem/xxx）
```
退出码非 0 → 按输出清单逐条修（优先 `--fix`）→ 重跑。**机检全绿≠定稿**，还要人工过下表右栏：

| ✅ 机检覆盖（validate_docx.py） | 👁 必须人工核对（机检看不到） |
|---|---|
| A4 / 页边距 / 页眉横线 | 字体真实渲染效果（Word/WPS 打开看） |
| 样式字号字体 / 一级标题另起页居中 | 图/表编号是否分章连续、无断号 |
| 页码三段结构（--framework） | GB/T 7714 著录格式逐条细节 |
| TOC 域存在 + updateFields | 目录"更新域"后页码是否正确、角标 [1] 是否保留 |
| 占位符残留（--content） | 摘要是否含选题意义/方法/结论、字数达标 |

**反偷懒：** 第一遍机检零报错时，再人工过一遍右栏；至少完成一轮"发现问题→修→复跑"才能宣布定稿。

## 常见踩坑（场景 → 后果 → 对策）

- 旧 `.doc` 图表编号是手打的 → 迁入新框架照抄会断号 → **按"图 1-1/表 1-1"分章重新连续编号**。
- 从旧文档粘来的表格不是三线格式 → 手调边框极易错位 → **用 `three_line_table()` 重建**。
- 纯文本提取丢了上标引用 [1] 的角标属性 → 变成普通方括号数字 → **在 docx 里逐处用上标 run 补回**。
- 模板项数与实际内容不符 → 残留孤儿章节或缺章 → **整段增删元素，不要只清空文字**。

## 边界与禁忌

- 目录/页码/三线表见「硬红线」，不复述。
- 规范原文有歧义 → 以 `spec-digest.md` 引用的原文措辞为准；速查未覆盖的条款回读附件1原 docx。
- 导师口头要求与规范冲突 → 学校下发模板 > 导师口头 > 本 skill 默认；冲突处先问用户再改。
- 只要求局部润色、不要整篇重排版 → 降级执行：跳过全量矫正，只 Edit 改指定段落。
