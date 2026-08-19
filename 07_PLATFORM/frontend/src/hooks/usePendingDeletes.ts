import { useState } from "react";

export function usePendingDeletes<T>() {
  const [ids, setIds] = useState<Set<T>>(new Set());

  function add(id: T): void {
    setIds((prev) => new Set(prev).add(id));
  }

  function remove(id: T): void {
    setIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return { isPending: (id: T) => ids.has(id), add, remove };
}
