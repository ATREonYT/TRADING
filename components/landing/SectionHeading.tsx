import { Reveal } from "./Reveal";

/** Consistent eyebrow + title + subtitle block used across sections. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  accent = "text-primary",
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  accent?: string;
}) {
  const alignCls = align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left";
  return (
    <Reveal className={alignCls}>
      <span className={`inline-flex items-center gap-2 text-2xs font-semibold uppercase tracking-widest ${accent}`}>
        <span className="h-1 w-1 rounded-full bg-current" />
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
    </Reveal>
  );
}
