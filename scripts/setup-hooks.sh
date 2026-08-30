#!/usr/bin/env bash
# scripts/setup-hooks.sh
# 一键配置仓库本地 git hooksPath 指向 .githooks/，并确保 hook 脚本可执行
# 无参数运行即可

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
HOOKS_DIR=".githooks"

cd "$REPO_ROOT"

if [[ ! -d "$HOOKS_DIR" ]]; then
  echo "❌ 找不到 $HOOKS_DIR/ 目录，请确认在正确的仓库根目录下运行。"
  exit 1
fi

# 确保 hook 脚本有可执行权限
HOOK_FILES=()
while IFS= read -r -d '' f; do
  HOOK_FILES+=("$f")
done < <(find "$HOOKS_DIR" -type f -not -name '*.sample' -not -name '*.md' -print0)

echo "🔧 为 hook 脚本设置可执行权限:"
for f in "${HOOK_FILES[@]}"; do
  if [[ -x "$f" ]]; then
    echo "   ✅ $f (已有可执行权限)"
  else
    chmod +x "$f"
    echo "   +x $f"
  fi
done

# 配置 git core.hooksPath
CURRENT_HOOKSPATH=$(git config core.hooksPath 2>/dev/null || echo "")
TARGET_HOOKSPATH="$HOOKS_DIR"

if [[ "$CURRENT_HOOKSPATH" == "$TARGET_HOOKSPATH" ]]; then
  echo ""
  echo "✅ git core.hooksPath 已配置为: $TARGET_HOOKSPATH"
else
  git config core.hooksPath "$TARGET_HOOKSPATH"
  echo ""
  echo "🔧 已将 git core.hooksPath 设置为: $TARGET_HOOKSPATH"
  if [[ -n "$CURRENT_HOOKSPATH" ]]; then
    echo "   (原值: $CURRENT_HOOKSPATH)"
  fi
fi

echo ""
echo "🎉 Git hooks 已启用。当前生效的 hooks:"
ls -1 "$HOOKS_DIR" | awk '{print "   - " $0}' || true
echo ""
echo "💡 临时绕过 hook（仅紧急情况）:"
echo "   git commit --no-verify    # 跳过 commit-msg + pre-commit"
echo "   git push --no-verify      # 跳过 pre-push"
