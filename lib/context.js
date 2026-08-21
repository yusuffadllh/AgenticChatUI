// Shared helpers for cleaning user input and keeping the context we send to the
// gateway within a token budget. The gateway rejects/parses poorly on very
// large payloads, so we (1) strip junk pasted from web pages out of the goal
// and (2) cap the total prompt to a token budget, building it up in stages so
// the payload is never suddenly huge.

// Rough token estimate: ~4 chars per token for English/code. Good enough for a
// safety budget without pulling in a tokenizer dependency.
const CHARS_PER_TOKEN = 4;

// Default hard ceiling for the context we send to the model.
export const MAX_CONTEXT_TOKENS = 150000;

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// Convert a token budget into a character budget.
export function tokensToChars(tokens) {
  return tokens * CHARS_PER_TOKEN;
}

// Clean a goal/prompt that a user may have pasted from a web page (e.g. a
// GitHub repo list), removing the boilerplate that adds noise without meaning.
export function cleanGoalInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;

  // Remove GitHub repo-listing boilerplate like "Public", "Private",
  // "Updated 40 minutes ago", "MIT License", star/fork counts, language tags
  // that get dragged in when copy-pasting a repo list.
  text = text
    .replace(/\bUpdated\s+\w+\s+\w+\s+ago\b/gi, '')
    .replace(/\b(Public|Private|Archived|Forked from[^\n]*)\b/gi, '')
    .replace(/\b[\w.-]+\s+License\b/gi, '')
    .replace(/\b\d+(?:\.\d+)?k?\s+(stars?|forks?)\b/gi, '');

  // Collapse excessive whitespace/newlines left behind by the removals.
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return text;
}

// Build a prompt from ordered sections while staying under a token budget.
// Sections are added one at a time (staged), and lower-priority sections are
// truncated or dropped first so the payload grows gradually and never blows
// past the budget in one shot.
//
// sections: Array<{ text: string, priority?: number, truncatable?: boolean }>
//   - priority: higher = more important (kept first). Default 0.
//   - truncatable: if true, may be cut down to fit. Default true.
export function buildBudgetedPrompt(sections, maxTokens = MAX_CONTEXT_TOKENS) {
  const budgetChars = tokensToChars(maxTokens);
  // Sort by priority desc so essential parts are placed first.
  const ordered = [...sections]
    .map((s, i) => ({ ...s, _i: i }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a._i - b._i);

  let used = 0;
  const kept = [];
  for (const s of ordered) {
    const text = (s.text || '').trim();
    if (!text) continue;
    const remaining = budgetChars - used;
    if (remaining <= 0) break;
    if (text.length <= remaining) {
      kept.push({ ...s, text });
      used += text.length;
    } else if (s.truncatable !== false) {
      // Truncate this section to what fits, marking it clearly.
      const slice = text.slice(0, Math.max(0, remaining - 20));
      kept.push({ ...s, text: `${slice}\n... (dipotong)` });
      used = budgetChars;
      break;
    }
    // If not truncatable and it doesn't fit, skip it entirely.
  }

  // Restore original order for the final prompt.
  kept.sort((a, b) => a._i - b._i);
  return kept.map((s) => s.text).join('\n\n');
}
