# 课程设计文档增量草稿（笔记系统与社区互动模块）

本目录存放《工程项目开发综合实践》学年论文（`feiyue.docx`）中**本人负责模块**的分章草稿与配图源文件，按增量模型逐章产出，最终由团队合并进 `feiyue.docx`。

| 文件 | 对应 docx 章节 | 状态 |
|---|---|---|
| `ch4-需求分析-笔记系统与社区互动.md` | 四、系统需求分析 | 草稿 |
| `figures/ch4-fig1-system-flow.svg` | 图 4-1 系统流程图 | 生成 |
| `figures/ch4-fig2-dfd-top.svg` | 图 4-2 顶层数据流图 | 生成 |
| `figures/ch4-fig3-dfd-publish.svg` | 图 4-3 功能级 DFD·草稿发布与自动摘要 | 生成 |
| `figures/ch4-fig4-dfd-report.svg` | 图 4-4 功能级 DFD·举报与 AI 审查裁决 | 生成 |
| `figures/ch4-fig5-usecase.svg` | 图 4-5 模块用例图 | 生成 |

## 合并到 Word 的注意事项

- 图为 SVG：Word 2016+ / 新版 WPS 可直接"插入→图片"；若目标机器不支持 SVG，用任意浏览器打开 SVG 截图，或装了转换工具后跑 `rsvg-convert -w 1600 x.svg -o x.png`。
- 图题在正文 md 中（"图 4-x ……"行），插入 Word 后按课程格式要求置于图下方、五号宋体加粗居中。
- 正文中「〔待填〕」为成员姓名/学号占位，合并时替换。
