"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function WelcomeIntroClient({
  destination,
  shouldPlay,
}: {
  destination: string;
  shouldPlay: boolean;
}) {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  const continueToDestination = useCallback(() => {
    setIsExiting(true);
    window.setTimeout(() => router.replace(destination), 220);
  }, [destination, router]);

  useEffect(() => {
    if (!shouldPlay) {
      router.replace(destination);
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const totalDuration = prefersReducedMotion ? 800 : 5000;
    const fadeDuration = prefersReducedMotion ? 180 : 450;
    const fadeTimer = window.setTimeout(() => setIsExiting(true), totalDuration - fadeDuration);
    const continueTimer = window.setTimeout(() => router.replace(destination), totalDuration);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(continueTimer);
    };
  }, [destination, router, shouldPlay]);

  if (!shouldPlay) {
    return <main className="min-h-dvh bg-zinc-950" aria-label="Preparing Falcon Hub" />;
  }

  return (
    <main
      className={`fixed inset-0 flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-white transition-opacity duration-500 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
      aria-label="Falcon Hub intro"
    >
      <style>{`
        @keyframes falconIntroMark {
          0% { opacity: 0; transform: translateY(8px) scale(0.985); }
          24% { opacity: 1; transform: translateY(0) scale(1); }
          86% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes falconIntroLine {
          0% { transform: scaleX(0); opacity: 0; }
          20% { transform: scaleX(0); opacity: 0; }
          44% { transform: scaleX(1); opacity: 1; }
          86% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes falconIntroTagline {
          0% { opacity: 0; transform: translateY(6px); }
          36% { opacity: 0; transform: translateY(6px); }
          64% { opacity: 1; transform: translateY(0); }
          86% { opacity: 1; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .falcon-intro-wordmark { animation: falconIntroMark 4.3s ease both; }
        .falcon-intro-line { animation: falconIntroLine 4.3s ease both; }
        .falcon-intro-tagline { animation: falconIntroTagline 4.3s ease both; }

        @media (prefers-reduced-motion: reduce) {
          .falcon-intro-wordmark,
          .falcon-intro-line,
          .falcon-intro-tagline {
            animation-duration: 700ms !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="text-center">
        <p className="falcon-intro-wordmark text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
          Falcon Hub
        </p>
        <div className="falcon-intro-line mx-auto mt-6 h-px w-40 origin-center bg-white/70 sm:w-52" />
        <p className="falcon-intro-tagline mt-6 text-sm font-medium tracking-[0.24em] text-zinc-300 sm:text-base">
          One Team · One Goal · One Falcon
        </p>
      </div>

      <button
        type="button"
        onClick={continueToDestination}
        className="absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        Skip
      </button>
    </main>
  );
}
