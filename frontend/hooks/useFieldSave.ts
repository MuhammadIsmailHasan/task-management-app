"use client";

import { useCallback, useRef, useState } from "react";
import { api, type CardInput } from "@/lib/api";
import { mergeSent, type FieldKey } from "@/lib/autosave";
import { ApiError } from "@/lib/http";
import type { Card } from "@/lib/types";

export type FieldState = { state: "idle" | "saving" | "saved" } | { state: "error"; message: string };

const SAVED_MS = 2000;

interface Options {
  cardId: string;
  onMerged: (update: (card: Card) => Card) => void;
  onSaved?: (saved: Card, sent: string[]) => void;
}

export function useFieldSave({ cardId, onMerged, onSaved }: Options) {
  const [status, setStatus] = useState<Partial<Record<FieldKey, FieldState>>>({});
  const inFlight = useRef(new Set<Promise<unknown>>());
  const failed = useRef(new Map<FieldKey, CardInput>());
  const timers = useRef(new Map<FieldKey, ReturnType<typeof setTimeout>>());

  const set = useCallback((field: FieldKey, value: FieldState) => setStatus((s) => ({ ...s, [field]: value })), []);

  const save = useCallback(
    (field: FieldKey, body: CardInput): Promise<boolean> => {
      clearTimeout(timers.current.get(field));
      set(field, { state: "saving" });
      const run = api.cards
        .update(cardId, body)
        .then((saved) => {
          failed.current.delete(field);
          onMerged((card) => mergeSent(card, saved, Object.keys(body)));
          onSaved?.(saved, Object.keys(body));
          set(field, { state: "saved" });
          timers.current.set(field, setTimeout(() => set(field, { state: "idle" }), SAVED_MS));
          return true;
        })
        .catch((err) => {
          failed.current.set(field, body);
          const details = err instanceof ApiError ? Object.values(err.details ?? {}).flat()[0] : undefined;
          set(field, { state: "error", message: details ?? (err instanceof ApiError ? err.message : "Could not save.") });
          return false;
        })
        .finally(() => inFlight.current.delete(run));
      inFlight.current.add(run);
      return run;
    },
    [cardId, onMerged, onSaved, set],
  );

  const retry = useCallback(
    (field: FieldKey) => {
      const body = failed.current.get(field);
      return body ? save(field, body) : Promise.resolve(true);
    },
    [save],
  );

  const whenIdle = useCallback(async () => {
    while (inFlight.current.size) await Promise.allSettled([...inFlight.current]);
  }, []);

  const hasFailed = useCallback(() => failed.current.size > 0, []);
  const busy = Object.values(status).some((s) => s?.state === "saving");

  return { status, save, retry, whenIdle, hasFailed, busy };
}
