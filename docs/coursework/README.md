# 课程设计文档增量草稿（笔记系统与社区互动模块）

本目录存放《工程项目开发综合实践》学年论文（`docs/赵文彪-飞跃 .docx`）中**本人负责模块**的分章草稿与配图源文件，按增量模型逐章产出，最终由 `scripts/update_coursework_docx.py` 合并进目标 docx。

## 章节草稿

| 文件 | 对应 docx 章节 |
|---|---|
| `ch4-需求分析-笔记系统与社区互动.md` | 四、系统需求分析 |
| `ch5-概要设计-笔记系统与社区互动.md` | 五、系统概要设计 |
| `ch6-详细设计-笔记系统与社区互动.md` | 六、系统详细设计 |
| `ch7-系统测试-笔记系统与社区互动.md` | 七、系统测试 |

## 配图清单（`figures/`，共 22 张）

图源由 `scripts/figlib.py` 及各 `scripts/gen_*.py` 生成，**单一数据源**同时产出可编辑的 `.drawio`（app.diagrams.net 打开）与渲染用 `.svg` / `.png`（cairosvg 光栅化后嵌入 Word）。改图请改对应 `gen_*.py` 后重新生成，不要手改 `.svg/.png`。

| 图号 | 图题 | 源文件 stem | 类型 |
|---|---|---|---|
| 图 4-1 | 系统流程图 | `ch4-fig1-system-flow` | 流程图 |
| 图 4-2 | 顶层数据流图 | `ch4-fig2-dfd-top` | DFD |
| 图 4-3 | 功能级 DFD·草稿发布与自动摘要 | `ch4-fig3-dfd-publish` | DFD |
| 图 4-4 | 功能级 DFD·互动/评论/合集/签到 | `ch4-fig4-dfd-interaction` | DFD |
| 图 4-5 | 模块用例图 | `ch4-fig5-usecase` | 用例图 |
| 图 5-1 | 模块总体架构 | `ch5-fig1-module-structure` | 组件图 |
| 图 5-2 | 领域模型 UML 类图（15 实体） | `ch5-fig2-class-domain` | 类图 |
| 图 6-1 | 程序结构 UML 类图（分层设计类） | `ch6-fig1-class-program` | 类图 |
| 图 6-2 | 写作页界面 /write | `ch6-fig2-ui-write` | 界面原型 |
| 图 6-3 | 信息流浏览页界面 /browse | `ch6-fig3-ui-browse` | 界面原型 |
| 图 6-4 | 笔记详情页界面 /note/:id | `ch6-fig4-ui-detail` | 界面原型 |
| 图 6-5 | 合集管理界面（规划） | `ch6-fig5-ui-collection` | 界面原型 |
| 图 6-6 | 举报工单管理界面（规划） | `ch6-fig6-ui-report` | 界面原型 |
| 图 6-7 | 每日签到弹窗界面 | `ch6-fig7-ui-checkin` | 界面原型 |
| 图 6-8 | 草稿发布与 AI 摘要降级顺序图 | `ch6-fig8-seq-publish` | 顺序图 |
| 图 6-9 | 举报—AI 审查—裁决顺序图（规划） | `ch6-fig9-seq-report` | 顺序图 |
| 图 6-10 | 合集上下文查询顺序图 | `ch6-fig10-seq-collection` | 顺序图 |
| 图 6-11 | 笔记生命周期状态图 | `ch6-fig11-state-note` | 状态图 |
| 图 6-12 | 评论状态图 | `ch6-fig12-state-comment` | 状态图 |
| 图 6-13 | 举报工单状态图（规划） | `ch6-fig13-state-report` | 状态图 |
| 图 6-14 | 信息流筛选/排序/分页活动图 | `ch6-fig14-activity-browse` | 活动图 |
| 图 6-15 | AI 流式摘要三层降级活动图 | `ch6-fig15-activity-ai` | 活动图 |

## 重新生成配图 + 合并进 docx

```bash
# 1) 生成全部 drawio + svg + png（需 python-docx / cairosvg，见 scripts/xju_docx）
python scripts/gen_class_diagrams.py    # 图5-2 / 图6-1
python scripts/gen_ch4.py               # 图4-1~4-5
python scripts/gen_ch5.py               # 图5-1
python scripts/gen_ch6.py               # 图6-8~6-15（顺序/状态/活动）
python scripts/gen_ch6_ui.py            # 图6-2~6-7（界面原型）

# 2) 把章节 + 配图合并进目标 docx，并套新疆大学规范
python scripts/update_coursework_docx.py

# 3) 机检格式（新大规范，全绿为准）
python scripts/xju_docx/validate_docx.py "docs/赵文彪-飞跃 .docx"
```

## 合并到 Word 的注意事项

- 图题在正文 md 中（“图 6-x ……”行），合并时置于图下方、五号宋体加粗居中（脚本已处理）。
- 「规划/预留」类图元（举报、拉黑、AI 审查、pending 隐藏态等）均按治理域后续规划表达，与代码事实一致（当前仅有 Report/Block 数据模型，无 `/reports`、`/blocks` 路由）。
- 正文中「〔待填〕」为成员姓名/学号占位，合并前替换。
