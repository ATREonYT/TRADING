export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-[1200px] px-4 py-12 lg:px-6">
        <div className="flex flex-col justify-between gap-8 sm:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-deep shadow-glow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 16c3-1 4-9 7-9s2 6 5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="5" cy="16" r="1.6" fill="#22D3EE" />
                </svg>
              </span>
              <span className="font-mono text-sm font-semibold tracking-tight text-ink">HELIX</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Real-time market intelligence: world news, catalyst analysis, and a full-market scanner for traders.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol
              title="Product"
              links={[
                { label: "Radar", href: "/radar" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Features", href: "#features" },
              ]}
            />
            <FooterCol
              title="Engine"
              links={[
                { label: "Catalysts", href: "#catalysts" },
                { label: "How it works", href: "#how" },
                { label: "Markets", href: "#markets" },
              ]}
            />
            <FooterCol
              title="Data"
              links={[
                { label: "65+ sources", href: "#features" },
                { label: "Sentiment", href: "#catalysts" },
              ]}
            />
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-2xs leading-relaxed text-faint">
          <span className="font-semibold text-muted">Not financial advice.</span> Helix is an automated
          information tool. Signals and catalyst tags are computed from public price, volume and news data
          using transparent heuristics — they are not recommendations to buy or sell any security. Markets
          are risky; do your own research.
          <div className="mt-2">© {new Date().getFullYear()} Helix. All data for informational purposes only.</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="text-2xs font-semibold uppercase tracking-widest text-faint">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
