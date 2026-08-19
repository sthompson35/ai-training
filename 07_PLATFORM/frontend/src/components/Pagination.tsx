import React from "react";

type Props = {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (offset: number) => void;
};

export function Pagination({ offset, limit, total, onOffsetChange }: Props): React.ReactElement | null {
  if (total === 0) return null;

  const start = offset + 1;
  const end = Math.min(offset + limit, total);

  return (
    <div style={{ margin: "12px 0" }}>
      <button disabled={offset === 0} onClick={() => onOffsetChange(Math.max(0, offset - limit))}>
        Previous
      </button>
      <span style={{ margin: "0 8px" }}>
        Showing {start}–{end} of {total}
      </span>
      <button disabled={end >= total} onClick={() => onOffsetChange(offset + limit)}>
        Next
      </button>
    </div>
  );
}
