export function logServerTiming(label: string, startedAt: number) {
  if (process.env.FALCON_PERF_LOGGING !== "true") return;

  const durationMs = Math.round(performance.now() - startedAt);
  console.info(`[perf] ${label} ${durationMs}ms`);
}
