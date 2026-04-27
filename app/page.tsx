import Nav from "@/components/ui/Nav";
import Scrollbar from "@/components/ui/Scrollbar";
import CarouselController from "@/components/canvas/CarouselController";
import Hero from "@/components/sections/Hero";
import PillarSection from "@/components/sections/PillarSection";
import Problem from "@/components/sections/Problem";
import Solution from "@/components/sections/Solution";
import Demo from "@/components/sections/Demo";
import Technology from "@/components/sections/Technology";
import UseCases from "@/components/sections/UseCases";
import CTA from "@/components/sections/CTA";
import Footer from "@/components/sections/Footer";
import SectionDivider from "@/components/ui/SectionDivider";
import CanvasMount from "@/components/canvas/CanvasMount";
import PrismController from "@/components/canvas/PrismController";
import RefreshScroll from "@/components/ui/RefreshScroll";

export default function Page() {
  return (
    <main className="relative">
      <CanvasMount />
      <RefreshScroll />
      <CarouselController />
      <PrismController />

      <div className="relative z-10">
        <Nav />
        <Scrollbar />
        <Hero />

        <SectionDivider label="II — The retrieval pipeline" />
        <PillarSection />

        <SectionDivider label="III — The problem" />
        <Problem />

        <SectionDivider label="IV — The solution" />
        <Solution />

        <SectionDivider label="V — The demo" />
        <Demo />

        <SectionDivider label="VI — The technology" />
        <Technology />

        <SectionDivider label="VII — Use cases" />
        <UseCases />

        <SectionDivider label="VIII — Begin" />
        <CTA />

        <Footer />
      </div>
    </main>
  );
}
