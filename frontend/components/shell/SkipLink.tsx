/** First focusable element of every page: jumps past the header and the rail to the main region (SHELL-25). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-modal focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
    >
      Skip to content
    </a>
  );
}
