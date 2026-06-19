/**
 * Detect "dead" interactions in a generated screen — buttons/rows that look
 * tappable but do nothing, or placeholder dialogs standing in for a real feature.
 * Used by the build to trigger one corrective AI repair pass (see build.ts).
 *
 * Kept deliberately conservative to avoid false positives on legitimate code:
 * we only flag clearly-empty handlers and a few unambiguous placeholder phrases
 * (NOT words like "todo" or "placeholder" that appear in real app content or in
 * a TextInput's placeholder prop).
 */

/** Empty arrow handlers: onPress={() => {}} / onPress={()=>{}} / => undefined. */
const EMPTY_HANDLER =
  /on[A-Z]\w*=\{\s*\(\s*\)\s*=>\s*(\{\s*\}|undefined|null|void 0)\s*\}/;

/** Unambiguous "this isn't built yet" copy, typically inside a stub appAlert. */
const PLACEHOLDER_COPY =
  /coming soon|not yet (available|implemented|built)|feature is coming|under construction|isn't available yet|is not available yet/i;

/** Return human-readable issues found in the code (empty = clean). */
export function findDeadButtons(code: string): string[] {
  const issues: string[] = [];
  if (EMPTY_HANDLER.test(code)) {
    issues.push("an onPress/handler that does nothing (empty arrow function)");
  }
  if (PLACEHOLDER_COPY.test(code)) {
    issues.push(
      'placeholder copy such as "coming soon" standing in for a real feature',
    );
  }
  return issues;
}

export function hasDeadButtons(code: string): boolean {
  return findDeadButtons(code).length > 0;
}
