import { Link } from 'react-router-dom';

// Demo screenshots captured from Humboldt Park, Chicago flow
const HERO_IMAGE = '/demo-screenshots/08-satellite-with-proposal.png';
const SCREENSHOT_CRASH = '/demo-screenshots/03-crash-heatmap-layers.png';
const SCREENSHOT_PROPOSAL = '/demo-screenshots/06-proposal-review.png';
const SCREENSHOT_INTERSECTION = '/demo-screenshots/12-intersection-review.png';
const SCREENSHOT_BEFORE = '/demo-screenshots/04-before-selector.png';

const DATA_SOURCES = [
  { city: 'New York City', source: 'NYC OpenData / NYPD', range: '2012–present' },
  { city: 'Chicago', source: 'City of Chicago / CPD E-Crash', range: '2015–present' },
  { city: 'Nationwide', source: 'NHTSA FARS (Fatal Crashes)', range: '2020–2023' },
];

const FEATURES = [
  {
    title: 'Crash-Informed Design',
    description: 'Real crash data from NYPD, Chicago PD, and NHTSA overlaid directly on the map. See exactly where people are getting hurt.',
    icon: HeatmapIcon,
    image: SCREENSHOT_CRASH,
  },
  {
    title: 'Street Proposals in Minutes',
    description: 'Pick a street, choose existing conditions, select a transformation. Get a professional before/after cross-section instantly.',
    icon: RoadIcon,
    image: SCREENSHOT_PROPOSAL,
  },
  {
    title: 'Intersection Improvements',
    description: 'Click any intersection to get data-driven improvement suggestions ranked by crash severity and complexity.',
    icon: IntersectionIcon,
    image: SCREENSHOT_INTERSECTION,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Curbwise satellite view of Humboldt Park, Chicago with crash heatmap"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/70 via-gray-900/50 to-gray-900/80" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32 lg:pt-36 lg:pb-44">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80 ring-1 ring-white/20 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live crash data from 3 sources
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] max-w-3xl">
            Design safer streets with
            <span className="text-blue-400"> real crash data</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl leading-relaxed">
            Curbwise puts crash data, street design tools, and intersection improvements
            into one map. Propose road diets, protected bike lanes, and safety fixes —
            all backed by real data from your city.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              to="/map"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full text-[15px] font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all duration-300 ease-spring active:scale-[0.97] shadow-[0_4px_24px_rgba(59,130,246,0.4)]"
            >
              Open the Map
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold text-white/80 hover:text-white ring-1 ring-white/20 hover:ring-white/40 transition-all duration-300 ease-spring"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── Trusted Data Sources ─────────────────────────────────── */}
      <section className="py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs font-bold text-gray-300 uppercase tracking-[0.2em] mb-8">
            Built on open safety data
          </p>
          <div className="flex flex-wrap justify-center gap-8 lg:gap-16">
            {DATA_SOURCES.map((src) => (
              <div key={src.city} className="text-center">
                <div className="text-sm font-bold text-gray-900">{src.city}</div>
                <div className="text-xs text-gray-400 mt-0.5">{src.source}</div>
                <div className="text-[10px] text-gray-300 mt-0.5">{src.range}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              Everything you need to advocate for safer streets
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              From crash analysis to street-level proposals — all in one tool, no GIS expertise required.
            </p>
          </div>

          <div className="flex flex-col gap-24 lg:gap-32">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              const isReversed = i % 2 === 1;

              return (
                <div
                  key={feature.title}
                  className={`flex flex-col gap-8 lg:gap-16 ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center`}
                >
                  {/* Text */}
                  <div className="flex-1 max-w-lg">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-base text-gray-500 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Screenshot */}
                  <div className="flex-1 max-w-2xl">
                    <div className="rounded-2xl overflow-hidden ring-1 ring-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.08)]">
                      <img
                        src={feature.image}
                        alt={feature.title}
                        className="w-full"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section className="py-24 lg:py-32 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
              From crash data to street proposal in 60 seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Search your street',
                description: 'Type any address. The map zooms in and loads crash data automatically.',
              },
              {
                step: '2',
                title: 'Choose a transformation',
                description: 'Pick existing conditions, then select from road diet, bike lanes, or complete street templates.',
              },
              {
                step: '3',
                title: 'Share your proposal',
                description: 'Get a professional before/after cross-section. Export as PDF for your city council meeting.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 ring-1 ring-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 lg:py-32">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Ready to make your streets safer?
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Curbwise is free and open source. Start designing today.
          </p>
          <div className="mt-10">
            <Link
              to="/map"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full text-base font-bold bg-blue-600 text-white hover:bg-blue-500 transition-all duration-300 ease-spring active:scale-[0.97] shadow-[0_4px_24px_rgba(59,130,246,0.4)]"
            >
              Open Curbwise
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19L8 5" /><path d="M16 5L20 19" /><path d="M12 6V8" /><path d="M12 11V13" /><path d="M12 16V18" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-900">Curbwise</span>
          </div>
          <p className="text-xs text-gray-400">
            Open-source street safety tool. Crash data from NYC OpenData, City of Chicago, and NHTSA FARS.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Inline SVG Icons ──────────────────────────────────────────────

function HeatmapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function RoadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19L8 5" /><path d="M16 5L20 19" /><path d="M12 6V8" /><path d="M12 11V13" /><path d="M12 16V18" />
    </svg>
  );
}

function IntersectionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7" /><path d="M12 2v6M12 16v6M2 12h6M16 12h6" />
    </svg>
  );
}
