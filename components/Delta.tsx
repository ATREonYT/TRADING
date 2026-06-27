import { ArrowUp, ArrowDown } from "./icons";
import { num } from "@/lib/format";

// Direction indicator: icon + sign + color (never color alone — a11y color-not-only)
export function Delta({
  value,
  format = (v) => `${num(v)}%`,
  size = "sm",
  className = "",
}: {
  value: number;
  format?: (v: number) => string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const up = value >= 0;
  const sizing =
    size === "lg" ? "text-base px-2 py-0.5" : size === "md" ? "text-sm px-1.5 py-0.5" : "text-2xs px-1.5 py-0.5";
  return (
    <span
      className={`tnum inline-flex items-center gap-1 rounded font-medium ${sizing} ${
        up ? "bg-up/10 text-up" : "bg-down/10 text-down"
      } ${className}`}
    >
      {up ? <ArrowUp size={size === "lg" ? 14 : 11} /> : <ArrowDown size={size === "lg" ? 14 : 11} />}
      {format(Math.abs(value))}
    </span>
  );
}
