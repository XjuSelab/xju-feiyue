# skills/ — 可复用的项目 AI 技能

本项目沉淀的、可被 AI 编码工具(Claude Code / Codex 等)复用的 skill 都放这里。
每个子目录一个 skill,含 `SKILL.md`(流程 + 触发说明)及其数据文件。
**明文 git 追踪**,便于团队共享、他人安装到本地。canonical 源在此目录;`.claude/` 不进 git。

## 现有 skill

| skill | 作用 |
|---|---|
| **update-docs** | 更新 `README.md` 与 GitHub Pages 发展历程页 `site/index.html`:读版本记忆(`update-docs/VERSIONS.md`)、依据最近 git 提交与对话归纳本次更新、置顶写新版本记录、刷新真实规模数据、推两库自动部署。 |

## 安装 / 激活

### Claude Code(本项目)
```bash
./skills/install.sh            # 软链每个 skill 到 ./.claude/skills/(仅本仓库生效)
./skills/install.sh --global   # 软链到 ~/.claude/skills/(全局生效)
```
之后在 Claude Code 里说「更新 README / 更新 Pages / 发个版」即触发,或直接 `/update-docs`。

### 手动 / 其他工具(Codex 等)
把 `skills/<name>/` 复制或软链到你的工具技能目录即可:
```bash
ln -sfn "$(pwd)/skills/update-docs" ~/.claude/skills/update-docs   # Claude 全局
cp -r skills/update-docs <codex 的技能/提示目录>/                   # 或按工具约定复制
```
Codex 等无独立 skill 机制的工具,可在其 `AGENTS.md` / 系统提示里引用 `skills/<name>/SKILL.md` 的流程。

> 说明:`.claude/` 是各人本地的 Claude Code 目录(含本地状态与这里软链过去的 skill),已 gitignore;
> 真正进库的只有本 `skills/` 目录,保证"一处维护、各处安装"。
