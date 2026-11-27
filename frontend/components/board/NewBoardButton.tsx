"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { NewBoardModal } from "@/components/shell/NewBoardModal";

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
