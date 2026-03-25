import type { Page } from '@playwright/test';

/**
 * Attach a listener that records browser console messages of type "error".
 * Call once per page early in the test; read `errors` after the flow completes.
 */
export function attachConsoleErrorCollector(page: Page): { errors: string[] } {
  const bucket = { errors: [] as string[] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      bucket.errors.push(msg.text());
    }
  });
  return bucket;
}

/** Errors we do not treat as regressions (React dev, flaky network, known Flowbite nesting noise). */
export function filterActionableConsoleErrors(messages: string[]): string[] {
  const noise =
    /Download the React DevTools|favicon|Failed to load resource.*404|validateDOMNesting|Error fetching current user profile|TypeError: Failed to fetch/i;
  return messages.filter((m) => !noise.test(m));
}
