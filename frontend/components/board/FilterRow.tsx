"use client";

import { ChipStrip } from "./ChipStrip";
import { BaseChip } from "@/components/shared/BaseChip";
import { categoryTone } from "@/lib/tones";
import type { Category } from "@/lib/types";

interface FilterRowProps {
  categories: Category[];
  categoryId: string | null;
  onCategory: (id: string | null) => void;
}

export function FilterRow({ categories, categoryId, onCategory }: FilterRowProps) {
  if (categories.length === 0) return <p className="text-xs text-ink-muted">No categories yet.</p>;
  return (
    <ChipStrip label="categories">
    <div role="group" aria-label="Filter by category" className="flex flex-nowrap gap-2">
      {categories.map((c) => (
        <BaseChip key={c.id} className="lowercase" tone={categoryTone(c)} active={categoryId === c.id} onClick={() => onCategory(categoryId === c.id ? null : c.id)}>
          {c.name}
        </BaseChip>
      ))}
    </div>
    </ChipStrip>
  );
}
