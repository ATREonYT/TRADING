/**
 * A 16x16 pixel booth glyph — striped awning, two posts, a counter with a sign.
 * Server-safe (plain SVG, no hooks).
 */
export default function PixelLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="pixelated shrink-0"
    >
      {/* awning top edge */}
      <rect x="1" y="1" width="14" height="1" fill="#23201A" />
      {/* awning body */}
      <rect x="1" y="2" width="14" height="3" fill="#D9480F" />
      {/* paper stripes */}
      <rect x="3" y="2" width="2" height="3" fill="#F2EFE7" />
      <rect x="7" y="2" width="2" height="3" fill="#F2EFE7" />
      <rect x="11" y="2" width="2" height="3" fill="#F2EFE7" />
      {/* scalloped awning fringe */}
      <rect x="2" y="5" width="2" height="1" fill="#D9480F" />
      <rect x="6" y="5" width="2" height="1" fill="#D9480F" />
      <rect x="10" y="5" width="2" height="1" fill="#D9480F" />
      {/* posts */}
      <rect x="1" y="5" width="1" height="9" fill="#23201A" />
      <rect x="14" y="5" width="1" height="9" fill="#23201A" />
      {/* counter */}
      <rect x="3" y="9" width="10" height="5" fill="#23201A" />
      {/* sign on the counter */}
      <rect x="4" y="10" width="8" height="3" fill="#F2EFE7" />
      <rect x="5" y="11" width="3" height="1" fill="#B08D2E" />
      <rect x="9" y="11" width="2" height="1" fill="#B08D2E" />
    </svg>
  );
}
