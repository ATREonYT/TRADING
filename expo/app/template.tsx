/**
 * Route template: remounts on every navigation, giving each screen one gentle
 * fade-up entrance so moving around the site feels smooth instead of snappy.
 * (Reduced-motion users get an instant swap — see globals.css.)
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
