import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function LandingPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const targetId = ['#government', '#reporting'].includes(location.hash)
      ? 'main-content'
      : location.hash.replace('#', '');
    const target = document.getElementById(targetId);
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-civic-paper text-civic-ink">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="border-b border-civic-line">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold tracking-tight" aria-label="Curbwise home">
            <StreetMark />
            Curbwise
          </Link>
          <Link to="/account" className="inline-flex min-h-11 items-center text-sm text-civic-muted hover:text-civic-ink">Account</Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-5 pb-8 sm:px-8">
        <section className="pb-8 pt-10 sm:pb-10 sm:pt-14">
          <h1 className="max-w-2xl text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.14] tracking-[-0.035em]">What would you change on your street?</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-civic-muted">Share an observation. Sketch an idea. Talk it through.</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/map" className="inline-flex min-h-12 items-center justify-center gap-5 rounded-md bg-civic-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-[#30414a]">
              Open the map <span aria-hidden="true">→</span>
            </Link>
            <Link to="/hotspots" className="inline-flex min-h-12 items-center text-sm font-medium underline decoration-civic-line underline-offset-4 hover:decoration-civic-ink">
              Community observations
            </Link>
          </div>
        </section>

        <DemoVideo />
      </main>
    </div>
  );
}

function DemoVideo() {
  return (
    <figure id="features" className="scroll-mt-5" aria-labelledby="map-demo-caption">
      <video
        controls
        playsInline
        preload="none"
        width="1920"
        height="962"
        poster="/demo-screenshots/community-workflow.jpg"
        aria-label="Street idea walkthrough"
        aria-describedby="map-demo-description"
        className="aspect-[960/481] w-full rounded border border-civic-line bg-civic-wash"
      >
        <source src="/demo-videos/community-workflow.webm" type="video/webm" />
        <source src="/demo-videos/community-workflow.mp4" type="video/mp4" />
        A silent walkthrough of a private draft, a street layout, and its map preview.
      </video>
      <figcaption id="map-demo-caption" className="mt-3 text-sm text-civic-muted">
        See it in use <span aria-hidden="true">·</span> <span>Demo</span>
        <a href="https://www.openstreetmap.org/copyright" className="float-right underline underline-offset-4">Map © OpenStreetMap</a>
      </figcaption>
      <p id="map-demo-description" className="sr-only">
        A silent recording of the current interface: start a private street idea, try a layout,
        and compare it on the map. Example only; nothing is published.
      </p>
    </figure>
  );
}

function StreetMark() {
  return (
    <svg aria-hidden="true" className="h-6 w-6 text-civic-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m3 20 5-16m8 0 5 16M12 5v3m0 3v3m0 3v3" />
    </svg>
  );
}
