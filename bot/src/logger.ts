// Minimal timestamped logger (no dependency)

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export const log = {
  info: (...a: unknown[]) => console.log(`\x1b[36m[${ts()}]\x1b[0m`, ...a),
  warn: (...a: unknown[]) => console.warn(`\x1b[33m[${ts()}] WARN\x1b[0m`, ...a),
  error: (...a: unknown[]) => console.error(`\x1b[31m[${ts()}] ERROR\x1b[0m`, ...a),
  ok: (...a: unknown[]) => console.log(`\x1b[32m[${ts()}]\x1b[0m`, ...a),
};
