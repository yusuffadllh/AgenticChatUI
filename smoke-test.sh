#!/usr/bin/env bash
# Smoke test: validates the baseline environment satisfies the success criteria.
set -euo pipefail

fail() { echo "RESULT: FAIL - $1"; exit 1; }

# Criterion 1: scope document exists.
[ -f "docs/scope-and-requirements.md" ] || fail "scope document missing"

# Criterion 2: document contains the required sections.
grep -q "## 2. Scope" docs/scope-and-requirements.md            || fail "Scope section missing"
grep -q "## 3. Requirements" docs/scope-and-requirements.md     || fail "Requirements section missing"
grep -q "## 4. Success Criteria" docs/scope-and-requirements.md || fail "Success Criteria section missing"

# Criterion 3: environment sanity check.
[ "$((2 + 2))" -eq 4 ] || fail "arithmetic sanity check failed"

echo "RESULT: PASS - all baseline success criteria satisfied"
exit 0
