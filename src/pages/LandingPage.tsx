import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const BROADWAY_PLAN_URL = 'https://denvergov.org/files/assets/public/v/1/doti/documents/programsservices/denver-moves-downtown/denver-moves-downtown-broadway-central-grand.pdf';

const DATA_SOURCES = [
  { city: 'Denver', source: 'Denver Police Department', range: 'Previous 5 calendar years + current year' },
  { city: 'New York City', source: 'NYC OpenData / NYPD', range: '2012-present' },
  { city: 'Chicago', source: 'City of Chicago / CPD E-Crash', range: '2015-present' },
];

export default function LandingPage() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    // Older municipal-sales links now lead to the observation-saving explanation.
    const targetId = location.hash === '#government' ? 'reporting' : location.hash.replace('#', '');
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
          <p className="text-sm text-civic-muted">A place to work on your street</p>
          <h1 className="mt-3 max-w-xl text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.14] tracking-[-0.035em]">Turn a street concern into a clear proposal.</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-civic-muted">Show what needs attention. Explore how the space could change. Bring a discussion brief to your neighbors, an organizer, or a planning conversation.</p>
          <Link to="/map" className="mt-6 inline-flex min-h-12 items-center justify-center gap-5 rounded-md bg-civic-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-[#30414a]">
            Start with a place <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section id="features" className="grid scroll-mt-5 items-start gap-7 border-t border-civic-line pt-6 md:grid-cols-[0.8fr_1.2fr]">
          <div>
          <h2 className="text-base font-semibold">From something you notice to something you can discuss.</h2>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <div className="grid grid-cols-[6rem_1fr] gap-4">
              <dt className="font-medium">Concern</dt>
              <dd className="text-civic-muted">Mark the place, describe what happens, and add a photo. An observation is enough to start.</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-4">
              <dt className="font-medium">Explore</dt>
              <dd className="text-civic-muted">Try a street layout and see what changes. Keep estimates and open questions visible.</dd>
            </div>
            <div className="grid grid-cols-[6rem_1fr] gap-4">
              <dt className="font-medium">Brief</dt>
              <dd className="text-civic-muted">Download your evidence, an optional concept, and what you’re asking for in one PDF.</dd>
            </div>
          </dl>
          <details id="reporting" className="mt-5 scroll-mt-5 text-xs leading-5 text-civic-muted">
            <summary className="min-h-11 cursor-pointer py-3">About saving an observation</summary>
            <p className="mt-1">Adding an observation to Curbwise does not send it to a city or 311.</p>
          </details>
          </div>
          <figure className="min-w-0" aria-labelledby="map-demo-caption">
            <video
              controls
              playsInline
              preload="none"
              width="1440"
              height="900"
              poster="/demo-screenshots/08-satellite-with-proposal.png"
              aria-label="Map and street concept demo"
              aria-describedby="map-demo-description"
              className="aspect-[8/5] w-full rounded border border-civic-line bg-civic-wash"
            >
              <source src="/demo-videos/curbwise-demo-compatible.mp4" type="video/mp4" />
              <source src="/demo-videos/curbwise-demo.webm" type="video/webm" />
              This silent demo shows a Chicago map search, crash layers, and street concepts.
            </video>
            <figcaption id="map-demo-caption" className="mt-3 text-sm font-medium">
              A closer look at the map <span className="font-normal text-civic-muted">· 46 seconds</span>
            </figcaption>
            <p id="map-demo-description" className="mt-1 text-xs leading-5 text-civic-muted">
              Earlier interface. This silent walkthrough explores Humboldt Park, Chicago, crash layers,
              and optional street concepts. Crash markers are separate from community observations.
            </p>
          </figure>
        </section>

        <section aria-label="Street concept example" className="mt-8 rounded border border-civic-line">
          <p className="px-4 py-4 text-sm leading-6 text-civic-muted sm:px-6">A concept makes the choices visible. Save a draft as you explore; bring your concern, assumptions, and requested next step into the discussion brief.</p>
          <figure className="overflow-hidden border-t border-civic-line" aria-labelledby="broadway-caption">
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-civic-line px-4 py-3 sm:px-6">
              <h2 className="text-sm font-semibold">Broadway, Denver</h2>
              <span className="text-xs text-civic-muted">A concept to discuss</span>
            </div>
            <BroadwayConcept />
            <figcaption id="broadway-caption" className="border-t border-civic-line px-4 py-4 sm:px-6">
              <p className="text-sm font-medium">One street. Different ways to share the space.</p>
              <p className="mt-1 text-xs leading-5 text-civic-muted">Original illustration only. Not to scale, a current-condition survey, or an approved project.</p>
            </figcaption>
            <details id="broadway-notes" className="border-t border-civic-line">
              <summary className="cursor-pointer px-4 py-4 text-sm font-medium marker:text-civic-muted sm:px-6">Sources, assumptions, and open questions</summary>
              <div className="space-y-5 px-4 pb-5 text-sm leading-6 text-civic-muted sm:px-6">
                <p>Denver’s <cite className="not-italic">Denver Moves: Downtown</cite> plan considers walking, protected bicycling, and dedicated transit on Broadway. This sketch explores those choices; it does not reproduce the city’s plan or describe today’s street. <a href={BROADWAY_PLAN_URL} className="font-medium text-civic-ink underline underline-offset-4">City’s Broadway corridor plan (PDF)</a></p>
                <div>
                  <h3 className="font-medium text-civic-ink">Still to work out</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>How people reach bus stops and cross the bikeway.</li>
                    <li>Where deliveries and accessible pickup fit.</li>
                    <li>What site measurements, turning movements, and maintenance needs allow.</li>
                  </ul>
                  <p className="mt-2">These are discussion questions, not field-research findings. Concepts need site measurements, engineering review, and city approval before implementation.</p>
                </div>
                <div>
                  <h3 className="font-medium text-civic-ink">Crash records available in the map</h3>
                  <dl className="mt-2 space-y-2">
                    {DATA_SOURCES.map((source) => (
                      <div key={source.city}>
                        <dt className="font-medium text-civic-ink">{source.city}</dt>
                        <dd><span>{source.source}</span> · <span>{source.range}</span></dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs leading-5">Records add context. They do not describe every street condition or replace a site visit.</p>
                </div>
              </div>
            </details>
          </figure>
        </section>
      </main>
    </div>
  );
}

function StreetMark() {
  return (
    <svg aria-hidden="true" className="h-6 w-6 text-civic-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="m3 20 5-16m8 0 5 16M12 5v3m0 3v3m0 3v3" />
    </svg>
  );
}

function BroadwayConcept() {
  return (
    <div className="bg-civic-wash px-3 pb-4 pt-4 sm:px-6">
      <svg role="img" aria-labelledby="broadway-diagram-title" aria-describedby="broadway-diagram-description" viewBox="0 0 880 218" className="w-full">
        <title id="broadway-diagram-title">Illustrative Broadway street-space concept</title>
        <desc id="broadway-diagram-description">A not-to-scale discussion sketch with space for walking, protected biking, transit, and street access. It does not show current conditions or a city-approved design.</desc>
        <path d="M20 190h174v20H20z" fill="#dce2e4" />
        <path d="M194 200h145v10H194z" fill="#e7bcb3" />
        <path d="M339 193h29v17h-29z" fill="#b2bec4" />
        <path d="M368 200h259v10H368zM627 200h233v10H627z" fill="#dce2e4" />
        <path d="M20 211h840" stroke="#172126" strokeWidth="2" />
        <g fill="none" stroke="#172126" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M69 189v-63M69 146l-12-12m12 30 16-13" />
          <path d="M53 89c-18 16-18 43 15 42 31 6 46-25 22-37-5-26-31-28-37-5Z" fill="#e1e6e8" />
          <circle cx="136" cy="132" r="8" fill="#fff" />
          <path d="m136 142-6 28m6-28 12 18m-15-5-14 9m11 6-9 20m9-20 14 20" />
          <circle cx="235" cy="184" r="15" /><circle cx="294" cy="184" r="15" />
          <path d="m235 184 18-28 18 28h-36m18-28h28l13 28m-24-43h17m-29 12 12-23m0 0 10-7" />
          <circle cx="282" cy="109" r="7" fill="#fff" />
          <path d="m276 120-20 13 12 17 18-9" />
          <rect x="399" y="95" width="196" height="96" rx="8" fill="#fff" />
          <path d="M413 110h43v31h-43zM467 110h43v31h-43zM527 109h50v77h-50z" fill="#e1e6e8" />
          <path d="M413 161h97M552 111v75" />
          <circle cx="429" cy="193" r="10" fill="#172126" /><circle cx="566" cy="193" r="10" fill="#172126" />
          <path d="m665 162 20-32h70l22 32 24 10v24H650v-24z" fill="#fff" />
          <path d="m692 139-12 23h81l-13-23z" fill="#e1e6e8" />
          <circle cx="680" cy="195" r="10" fill="#172126" /><circle cx="776" cy="195" r="10" fill="#172126" />
          <path d="M354 192v-26m-7 0h14" />
        </g>
      </svg>
      <div className="grid grid-cols-[174fr_174fr_259fr_233fr] gap-1 px-[2.3%] pt-2 text-center text-xs leading-4 text-civic-muted">
        <span>Walk &amp; roll</span><span>Protected biking</span><span>Transit</span><span>Street access</span>
      </div>
    </div>
  );
}
