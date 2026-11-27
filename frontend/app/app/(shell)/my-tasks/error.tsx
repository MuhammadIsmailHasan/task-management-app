"use client";

import { BaseButton } from "@/components/shared/BaseButton";

export default function MyTasksError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-page py-12 text-center">
      <h1 className="font-heading text-xl text-danger">Could not load your tasks.</h1>
      <BaseButton variant="secondary" onClick={reset}>
        Retry
      </BaseButton>
    </div>
  );
}
