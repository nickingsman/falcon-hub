"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type YouTubeProgress = {
  lastPositionSeconds: number;
  maxWatchedSeconds: number;
  learningPercentage: number | null;
  isCompleted: boolean;
  completedAt: string | null;
};

type YouTubeProgressPlayerProps = {
  lessonId: string;
  title: string;
  embedUrl: string;
  initialProgress: YouTubeProgress;
  onProgressSaved: (progress: YouTubeProgress) => void;
};

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};

type YouTubePlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars: Record<string, number>;
    events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
    falconAcademyYouTubeApiReady?: Promise<void>;
  }
}

const saveIntervalMs = 12000;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (window.falconAcademyYouTubeApiReady) return window.falconAcademyYouTubeApiReady;

  window.falconAcademyYouTubeApiReady = new Promise<void>((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return window.falconAcademyYouTubeApiReady;
}

function getYouTubeVideoId(embedUrl: string) {
  try {
    const url = new URL(embedUrl);
    const parts = url.pathname.split("/").filter(Boolean);

    return parts[1] ?? null;
  } catch {
    return null;
  }
}

function safeSeconds(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export default function YouTubeProgressPlayer({
  lessonId,
  title,
  embedUrl,
  initialProgress,
  onProgressSaved,
}: YouTubeProgressPlayerProps) {
  const playerElementId = useMemo(
    () => `academy-youtube-${lessonId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [lessonId],
  );
  const playerRef = useRef<YouTubePlayer | null>(null);
  const isPlayingRef = useRef(false);
  const previousTimeRef = useRef<number | null>(null);
  const earnedMaxSecondsRef = useRef(initialProgress.maxWatchedSeconds);
  const lastSavedAtRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const latestProgressRef = useRef(initialProgress);
  const onProgressSavedRef = useRef(onProgressSaved);
  const [playerReady, setPlayerReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const videoId = useMemo(() => getYouTubeVideoId(embedUrl), [embedUrl]);

  useEffect(() => {
    onProgressSavedRef.current = onProgressSaved;
  }, [onProgressSaved]);

  const saveProgress = useCallback(
    async (reason: "interval" | "pause" | "ended" | "pagehide") => {
      const player = playerRef.current;
      if (!player || saveInFlightRef.current) return;

      const currentTime = safeSeconds(player.getCurrentTime());
      const observedDuration = safeSeconds(player.getDuration());
      const now = Date.now();

      if (reason === "interval" && now - lastSavedAtRef.current < saveIntervalMs) return;
      if (
        currentTime === latestProgressRef.current.lastPositionSeconds &&
        earnedMaxSecondsRef.current === latestProgressRef.current.maxWatchedSeconds
      ) {
        return;
      }

      saveInFlightRef.current = true;
      setSaveState("saving");

      try {
        const response = await fetch(`/api/academy/lessons/${lessonId}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lastPositionSeconds: currentTime,
            maxWatchedSeconds: earnedMaxSecondsRef.current,
            observedDurationSeconds: observedDuration || undefined,
          }),
          keepalive: reason === "pagehide",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to save progress");
        }

        latestProgressRef.current = result.progress;
        earnedMaxSecondsRef.current = Math.max(
          earnedMaxSecondsRef.current,
          result.progress.maxWatchedSeconds,
        );
        lastSavedAtRef.current = now;
        onProgressSavedRef.current(result.progress);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [lessonId],
  );

  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;
    let player: YouTubePlayer | null = null;

    void loadYouTubeApi().then(() => {
      if (!isMounted || !window.YT?.Player) return;

      player = new window.YT.Player(playerElementId, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            setPlayerReady(true);

            const resumePosition = latestProgressRef.current.lastPositionSeconds;
            const duration = safeSeconds(player?.getDuration() ?? 0);
            const shouldResume =
              !latestProgressRef.current.isCompleted &&
              resumePosition > 5 &&
              (!duration || resumePosition < duration - 10);

            if (shouldResume) {
              player?.seekTo(resumePosition, true);
              previousTimeRef.current = resumePosition;
            }

          },
          onStateChange: (event) => {
            if (!window.YT) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlayingRef.current = true;
              previousTimeRef.current = safeSeconds(player?.getCurrentTime() ?? 0);
            }

            if (event.data === window.YT.PlayerState.PAUSED) {
              isPlayingRef.current = false;
              void saveProgress("pause");
            }

            if (event.data === window.YT.PlayerState.ENDED) {
              const currentTime = safeSeconds(player?.getCurrentTime() ?? 0);
              const previousTime = previousTimeRef.current;
              if (previousTime !== null && currentTime >= previousTime) {
                const delta = currentTime - previousTime;
                if (delta <= 3 && previousTime <= earnedMaxSecondsRef.current + 3) {
                  earnedMaxSecondsRef.current = Math.max(
                    earnedMaxSecondsRef.current,
                    currentTime,
                  );
                }
              }
              isPlayingRef.current = false;
              void saveProgress("ended");
            }
          },
        },
      });
    });

    return () => {
      isMounted = false;
      player?.destroy();
      playerRef.current = null;
    };
  }, [playerElementId, saveProgress, videoId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || !isPlayingRef.current) return;

      const currentTime = player.getCurrentTime();
      const previousTime = previousTimeRef.current;

      if (previousTime !== null && Number.isFinite(currentTime)) {
        const delta = currentTime - previousTime;

        if (delta > 0 && delta <= 3 && previousTime <= earnedMaxSecondsRef.current + 3) {
          earnedMaxSecondsRef.current = Math.max(
            earnedMaxSecondsRef.current,
            currentTime,
          );
        }
      }

      previousTimeRef.current = Number.isFinite(currentTime) ? currentTime : previousTime;
      void saveProgress("interval");
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [saveProgress]);

  useEffect(() => {
    function handlePageHide() {
      void saveProgress("pagehide");
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [saveProgress]);

  if (!videoId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-sm font-semibold text-white">This YouTube URL cannot be embedded.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div id={playerElementId} className="h-full w-full" title={`${title} video`} />
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-zinc-950/70 px-3 py-1 text-xs font-semibold text-white">
        {!playerReady
          ? "Loading"
          : saveState === "saving"
            ? "Saving"
            : saveState === "error"
              ? "Progress will retry"
              : "Progress tracking on"}
      </div>
    </div>
  );
}
