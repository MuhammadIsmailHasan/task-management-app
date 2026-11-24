"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { NewBoardModal } from "@/components/shell/NewBoardModal";

/** "New board" on Home for a Manager or an Admin (the Board_Switcher carries the same action on a Board page). */
export function NewBoardButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <BaseButton onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        New board
      </BaseButton>
      <NewBoardModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
