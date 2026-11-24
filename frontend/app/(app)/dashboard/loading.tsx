/** The Dashboard's loading state: skeleton blocks of the shapes they stand for (DASH-07). */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 px-page pt-2 pb-6">
      <div className="h-tile w-popover rounded-card bg-surface-strong" />
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-modal-skeleton rounded-frame bg-surface-strong" />
        ))}
      </div>
    </div>
  );
}
