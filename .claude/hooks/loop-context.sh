#!/usr/bin/env bash
# UserPromptSubmit hook: injects a pointer to docs/LOOP_ENGINEERING.md, but only
# when the prompt looks loop-related. Non-matching prompts emit nothing, so the
# loop-engineering guidance costs zero context tokens the rest of the time
# (which is why it lives here and not in CLAUDE.md).

PROMPT=$(jq -r '.prompt // ""' 2>/dev/null)

if printf '%s' "$PROMPT" | grep -qiE '\b(loops?|looping|recurring|schedul(e|ed|er|ing)|cron|babysit(ting)?|poll(ing)?|wake-?ups?|monitor(ing)?|automat(e|ed|ion)|watch(ing)? (the |a |this )?pr)\b|/loop|/goal|/schedule'; then
  cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"This prompt looks loop-related. Read docs/LOOP_ENGINEERING.md (loop types, stop conditions, token-usage rules, and this repo's existing loop patterns) before choosing an approach."}}
EOF
fi
exit 0
