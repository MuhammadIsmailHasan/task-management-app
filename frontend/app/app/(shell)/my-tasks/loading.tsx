/** My Tasks' loading state: blocks of the shapes they stand for (TASK-03). */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 px-page pt-surface pb-surface">
      <div className="h-tile w-popover rounded-ui bg-surface-strong" />
      <div className="h-modal-skeleton rounded-ui bg-surface-strong" />
    </div>
  );
}
