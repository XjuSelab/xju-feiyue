#!/usr/bin/env bash
# 把本仓库 skills/ 下每个 skill 软链到本地 Claude Code 技能目录,激活后即可用。
#
# 用法:
#   ./skills/install.sh            # 软链到 ./.claude/skills/(仅本仓库生效)
#   ./skills/install.sh --global   # 软链到 ~/.claude/skills/(全局生效)
#
# 其他工具(Codex 等):按各自约定把 skills/<name>/SKILL.md 复制或引用过去即可。
set -euo pipefail

cd "$(dirname "$0")/.."          # 仓库根
SRC="$(pwd)/skills"

DEST=".claude/skills"
if [ "${1:-}" = "--global" ]; then
  DEST="$HOME/.claude/skills"
fi

mkdir -p "$DEST"
n=0
for d in "$SRC"/*/; do
  [ -f "${d}SKILL.md" ] || continue        # 只链真正的 skill 目录
  name="$(basename "$d")"
  ln -sfn "${d%/}" "$DEST/$name"
  echo "linked  $name  ->  $DEST/$name"
  n=$((n + 1))
done
echo "done: $n skill(s) → $DEST"
[ "$DEST" = ".claude/skills" ] && echo "提示:在 Claude Code 里 /<skill> 或自然语言触发;改动后无需重装(软链)。"
