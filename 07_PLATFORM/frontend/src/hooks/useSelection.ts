import { useState } from "react";

export function useSelection<T>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  function toggle(id: T): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(ids: T[]): void {
    setSelected(new Set(ids));
  }

  function clear(): void {
    setSelected(new Set());
  }

  return { selected, toggle, selectAll, clear, isSelected: (id: T) => selected.has(id) };
}
