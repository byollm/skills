#!/usr/bin/env bash
# extract-tool-calls.sh — pull one tool's calls (and their results) out of
# Claude Code session transcripts, as JSONL, deterministically (no LLM).
#
#   extract-tool-calls.sh <tool-name> <jq-select-on-input> <transcript.jsonl>...
#
# Example (every Bash call whose command contains a heredoc):
#   extract-tool-calls.sh Bash '.command|test("<<")' ~/.claude/projects/-Users-me-dev-app/*.jsonl
#
# Output, one object per call:
#   {"session":"<file>","ts":"<iso>","id":"<tool_use_id>","input":{...},
#    "is_error":bool|null,"result":"<first 2000 chars>"}
#
# Transcripts are large (hundreds of MB). This streams each file twice with
# jq and joins only the matching calls, so memory stays small.
set -euo pipefail
[ $# -ge 3 ] || { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
tool=$1; sel=$2; shift 2
tmp=$(/usr/bin/mktemp -d); trap '/bin/rm -rf "$tmp"' EXIT
for f in "$@"; do
  jq -c --arg T "$tool" --arg S "$(basename "$f")" '
    select(.type=="assistant") | .timestamp as $ts | .message.content[]?
    | select(.type=="tool_use" and .name==$T)
    | select(.input | '"$sel"')
    | {session:$S, ts:$ts, id:.id, input:.input}' "$f" > "$tmp/calls.jsonl" 2>/dev/null || true
  [ -s "$tmp/calls.jsonl" ] || continue
  jq -c 'select(.type=="user") | .message.content[]?
    | select(.type=="tool_result")
    | {id:.tool_use_id, is_error:(.is_error // null),
       result:((.content|if type=="array" then map(.text? // "")|join("") else tostring end)|.[0:2000])}' \
    "$f" > "$tmp/results.jsonl" 2>/dev/null || true
  jq -c -n --slurpfile r "$tmp/results.jsonl" '
    ($r | map({(.id): .}) | add // {}) as $m
    | inputs | . + (($m[.id] // {}) | {is_error, result})' "$tmp/calls.jsonl"
done
