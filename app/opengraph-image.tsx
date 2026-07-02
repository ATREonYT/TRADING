import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Helix — trade the news before it moves the tape";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card. Kept to Satori-safe CSS (linear-gradients only,
// no emoji/special glyphs that would require a network font fetch).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0B1428 0%, #070A12 60%, #0A2020 100%)",
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #3B82F6, #1E40AF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              fontWeight: 800,
              color: "white",
            }}
          >
            H
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4 }}>HELIX</div>
          <div
            style={{
              marginLeft: 12,
              padding: "6px 16px",
              borderRadius: 999,
              border: "1px solid #23304A",
              color: "#94A3B8",
              fontSize: 20,
            }}
          >
            Market Intelligence
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.05, maxWidth: 940 }}>
            Trade the news before it moves the tape.
          </div>
          <div style={{ fontSize: 30, color: "#94A3B8", maxWidth: 900 }}>
            Live news from 65+ sources. Catalyst analysis. Full-market scanner.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Earnings Beat", "Fed / Rates", "Guidance Cut", "Volume Spike"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 12,
                background: "#161F30",
                border: "1px solid #23304A",
                color: "#CBD5E1",
                fontSize: 24,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
