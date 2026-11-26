/** My Tasks' loading state: blocks of the shapes they stand for (TASK-03). */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 px-page pt-2 pb-6">
      <div className="h-tile w-popover rounded-card bg-surface-strong" />
      <div className="h-modal-skeleton rounded-frame bg-surface-strong" />
    </div>
  );
}
