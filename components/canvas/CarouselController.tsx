"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "@/hooks/useGsapScroll";
import { scrollState } from "@/lib/scrollState";

/**
 * Spans Solution → Use cases (start of section IV through end of VI/start of VII).
 * The carousel:
 *  - fades in as Solution arrives,
 *  - lerps its orbit centre forward through Demo (zoom finishes early),
 *  - persists all the way through Tech,
 *  - fades out only as Use cases comes into view.
 */
export default function CarouselController() {
  useEffect(() => {
    let trigger: ScrollTrigger | null = null;
    let raf = 0;

    const tryCreate = () => {
      const startEl = document.getElementById("demo");
      const endEl = document.getElementById("use-cases");
      if (!startEl || !endEl) {
        raf = requestAnimationFrame(tryCreate);
        return;
      }

      trigger = ScrollTrigger.create({
        trigger: startEl,
        endTrigger: endEl,
        // Carousel fades in a bit after Section 5 (Demo) appears.
        start: "top 30%",
        end: "top 30%",
        onUpdate: (self) => {
          scrollState.carouselProgress = self.progress;
        },
        onEnter: () => {
          scrollState.carouselVisible = true;
        },
        onEnterBack: () => {
          scrollState.carouselVisible = true;
        },
        onLeave: () => {
          scrollState.carouselVisible = false;
        },
        onLeaveBack: () => {
          scrollState.carouselVisible = false;
        },
      });
    };

    raf = requestAnimationFrame(tryCreate);

    return () => {
      cancelAnimationFrame(raf);
      trigger?.kill();
    };
  }, []);

  return null;
}
