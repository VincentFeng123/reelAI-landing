"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/hooks/useGsapScroll";
import { scrollState } from "@/lib/scrollState";

const SECTIONS = 7;

export default function Cursor() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const label = labelRef.current;
    if (!wrapper || !label) return;

    if (window.matchMedia("(hover: none)").matches) {
      wrapper.style.display = "none";
      return;
    }

    // Hide the native cursor immediately at mount, so it can't briefly flash
    // through during scroll, fast pointer moves, or before the first
    // mousemove fires.
    document.body.classList.add("cursor-on");

    const xTo = gsap.quickTo(wrapper, "x", { duration: 0.08, ease: "power3" });
    const yTo = gsap.quickTo(wrapper, "y", { duration: 0.08, ease: "power3" });

    let snapped = false;
    let hoverText: string | null = null;
    let lastLabel = "";

    const renderLabel = () => {
      let text: string;
      if (hoverText) {
        text = hoverText;
      } else {
        const pct = Math.round(scrollState.progress * 100);
        const sec = Math.min(
          SECTIONS,
          Math.max(1, Math.ceil(scrollState.progress * SECTIONS) || 1),
        );
        text = `${String(pct).padStart(2, "0")}% · ${String(sec).padStart(2, "0")}/${String(SECTIONS).padStart(2, "0")}`;
      }
      if (text !== lastLabel) {
        label.textContent = text;
        lastLabel = text;
      }
    };

    const onMove = (e: MouseEvent) => {
      if (!snapped) {
        // Snap to the actual pointer position before the first smoothed
        // tween, so the cursor doesn't fly in from off-screen.
        gsap.set(wrapper, { x: e.clientX, y: e.clientY });
        snapped = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);
    };

    const onDown = () => document.body.classList.add("cursor-pressed");
    const onUp = () => document.body.classList.remove("cursor-pressed");

    const addHover = (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      hoverText =
        target.dataset.cursorLabel ||
        (target.tagName === "A" || target.tagName === "BUTTON"
          ? "open"
          : "view");
      document.body.classList.add("cursor-hover");
    };

    const removeHover = () => {
      hoverText = null;
      document.body.classList.remove("cursor-hover");
    };

    const targets = document.querySelectorAll(
      "a, button, [data-cursor='hover']",
    );
    targets.forEach((el) => {
      el.addEventListener("mouseenter", addHover);
      el.addEventListener("mouseleave", removeHover);
    });

    // Fade the custom cursor out when the pointer leaves the page (URL bar,
    // dev tools, OS chrome, another tab) and back in on re-entry. Snap to
    // the entry coordinates so it doesn't briefly appear at the stale exit
    // position before the next mousemove updates it.
    const onDocLeave = () => {
      wrapper.style.opacity = "0";
    };
    const onDocEnter = (e: MouseEvent) => {
      gsap.set(wrapper, { x: e.clientX, y: e.clientY });
      wrapper.style.opacity = "1";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.documentElement.addEventListener("mouseleave", onDocLeave);
    document.documentElement.addEventListener("mouseenter", onDocEnter);

    let raf = 0;
    const loop = () => {
      renderLabel();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.removeEventListener("mouseleave", onDocLeave);
      document.documentElement.removeEventListener("mouseenter", onDocEnter);
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", addHover);
        el.removeEventListener("mouseleave", removeHover);
      });
    };
  }, []);

  return (
    <div ref={wrapperRef} className="cursor-wrapper" aria-hidden>
      <div className="cursor-reticle">
        <span className="cursor-corner tl" />
        <span className="cursor-corner tr" />
        <span className="cursor-corner bl" />
        <span className="cursor-corner br" />
        <span className="cursor-crosshair h" />
        <span className="cursor-crosshair v" />
        <span className="cursor-aim" />
      </div>
      <div ref={labelRef} className="cursor-label">
        00% · 01/07
      </div>
    </div>
  );
}
