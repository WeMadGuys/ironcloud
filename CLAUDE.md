# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Multi-Platform UI Consistency

**This repo targets mobile (iOS/Android) and web from a shared codebase. Every UI change must work across all targets.**

Before implementing UI:
- Identify which platforms the component/screen will render on (web, iOS, Android, or all).
- Don't hardcode pixel values, fixed widths/heights, or assumptions about a single screen size.
- Use responsive/adaptive layout primitives (flex, percentage/relative units, safe-area-aware spacing) instead of fixed dimensions.

When building or editing a component:
- Check behavior at common breakpoints: small mobile (~360-390px), large mobile/tablet (~768px), and desktop web (~1280px+).
- Account for platform-specific UI conventions (e.g., iOS safe areas/notch, Android back gesture zones, browser scrollbars, hover states that don't exist on touch devices).
- Avoid platform-exclusive APIs/components unless the task explicitly targets a single platform - prefer shared cross-platform components.
- If a platform-specific branch (`Platform.OS === 'ios'`, media queries, etc.) is unavoidable, isolate it and comment why.

Before finishing:
- State which platforms/resolutions you considered and any you couldn't verify.
- If a change only makes sense on one platform, flag that explicitly rather than silently applying it everywhere.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
