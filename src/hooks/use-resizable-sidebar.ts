"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Drag-to-resize sidebar width (matches Claude Design `useResizable` behavior). */
export function useResizableSidebar(
  initial: number,
  { min, max }: { min: number; max: number },
) {
  const [width, setWidth] = useState(initial);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const onGripMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = { startX: e.clientX, startW: width };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.startX;
      const next = Math.min(max, Math.max(min, drag.current.startW + dx));
      setWidth(next);
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [min, max]);

  return { width, onGripMouseDown, setWidth };
}
