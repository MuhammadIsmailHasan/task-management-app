"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface BaseTab {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

interface BaseTabsProps {
  tabs: BaseTab[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}

export function BaseTabs({ tabs, value, onValueChange, label }: BaseTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="flex flex-col gap-4">
      <TabsList aria-label={label}>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
