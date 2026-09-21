#!/bin/sh
# Run every Simpli Piano test.
#
#     sh tests/run.sh
#
# This is the autosave push gate (`.claude/source.json` "test"), so a red suite
# keeps work from reaching GitHub. The hook runs with a minimal PATH, which is
# why node is resolved explicitly rather than assumed — a bare `node` that is
# not found would make the gate silently "pass" by never running.

set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

NODE=$(command -v node 2>/dev/null || true)
[ -n "$NODE" ] || for c in /opt/homebrew/bin/node /usr/local/bin/node; do
    [ -x "$c" ] && NODE=$c && break
done

if [ -z "$NODE" ]; then
    echo "node not found — cannot run the Simpli Piano tests." >&2
    echo "Tried: PATH, /opt/homebrew/bin/node, /usr/local/bin/node" >&2
    exit 1
fi

echo "Using $NODE ($("$NODE" -v))"

fails=0
for f in tests/theory.test.js tests/engine.test.js tests/course.test.js tests/stats.test.js; do
    echo ""
    echo "── $f"
    "$NODE" "$f" || fails=$((fails + 1))
done

echo ""
"$NODE" tests/icloud-conflicts.test.mjs || fails=$((fails + 1))

echo ""
if [ "$fails" -gt 0 ]; then
    echo "❌ $fails test file(s) failed."
    exit 1
fi
echo "✅ All Simpli Piano tests passed."
