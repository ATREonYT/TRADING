// Animated aurora backdrop — soft, blurred, screen-blended color blobs. Purely
// decorative; sits behind content with -z-10/-20.
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div
        className="aurora-blob animate-float"
        style={{ top: "-6%", left: "8%", width: 360, height: 360, background: "#3B82F6" }}
      />
      <div
        className="aurora-blob animate-float [animation-delay:1.5s]"
        style={{ top: "10%", right: "6%", width: 300, height: 300, background: "#26A69A" }}
      />
      <div
        className="aurora-blob animate-float [animation-delay:3s]"
        style={{ bottom: "-10%", left: "35%", width: 420, height: 420, background: "#1E40AF" }}
      />
      <div
        className="aurora-blob animate-float [animation-delay:2.2s]"
        style={{ bottom: "4%", right: "24%", width: 220, height: 220, background: "#F59E0B", opacity: 0.28 }}
      />
    </div>
  );
}
