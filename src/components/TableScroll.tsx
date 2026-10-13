"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type EdgeState = {
  overflow: boolean;
  moreLeft: boolean;
  moreRight: boolean;
};

function measure(el: HTMLElement): EdgeState {
  const maxScroll = el.scrollWidth - el.clientWidth;
  const overflow = maxScroll > 1;
  return {
    overflow,
    moreLeft: overflow && el.scrollLeft > 1,
    moreRight: overflow && el.scrollLeft < maxScroll - 1,
  };
}

/** Horizontal scroll pane with a faint scrollbar and edge fades when content overflows. */
export function TableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<EdgeState>({
    overflow: false,
    moreLeft: false,
    moreRight: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setEdges(measure(el));
    update();

    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div
      className={[
        "table-scroll-shell",
        edges.overflow ? "table-scroll-shell--overflow" : undefined,
        edges.moreLeft ? "table-scroll-shell--more-left" : undefined,
        edges.moreRight ? "table-scroll-shell--more-right" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={ref} className="table-scroll">
        {children}
      </div>
    </div>
  );
}
