import React, { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
  Track,
} from "livekit-client";
import { stopWorkflow } from "../../api/workflow";
import theme from "../../theme";

const STATUS_LABELS = {
  connecting:     "Connecting…",
  connected:      "Listening",
  agent_speaking: "Agent speaking",
  disconnected:   "Disconnected",
};

export default function VoiceSessionPanel({ workflowId, session, onStop }) {
  const roomRef = useRef(null);
  const audioRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let localTrack = null;
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    // livekit-client 2.x: fires when browser blocks/unblocks audio playback
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.autoplay = true;
        // Append to DOM so the browser can play it
        document.body.appendChild(el);
        // Explicitly trigger playback to bypass autoplay policy
        el.play().catch(() => setAudioBlocked(true));
        setStatus("agent_speaking");
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach();
        setStatus("connected");
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus("disconnected");
    });

    (async () => {
      try {
        await room.connect(session.livekit_url, session.token);
        if (cancelled) return;
        setStatus("connected");

        // Resume audio context — must be called after user interaction (Launch click)
        await room.startAudio();

        localTrack = await createLocalAudioTrack();
        if (cancelled) return;
        await room.localParticipant.publishTrack(localTrack);
      } catch (err) {
        // "Client initiated disconnect" fires in React StrictMode dev cleanup — safe to ignore.
        if (!cancelled) {
          console.error("LiveKit connection error:", err.message);
          setStatus("disconnected");
        }
      }
    })();

    return () => {
      cancelled = true;
      localTrack?.stop();
      // Clean up any audio elements appended to body
      document.querySelectorAll("audio[data-lk-audio]").forEach((el) => el.remove());
      room.disconnect();
    };
  }, [session]);

  const handleUnblockAudio = async () => {
    await roomRef.current?.startAudio();
    setAudioBlocked(false);
  };

  const handleStop = async () => {
    roomRef.current?.disconnect();
    await stopWorkflow(workflowId);
    onStop();
  };

  const isActive = status !== "disconnected";
  const isSpeaking = status === "agent_speaking";

  const statusColor = {
    connecting:     theme.textDisabled,
    connected:      "#34a853",
    agent_speaking: "#fbbc04",
    disconnected:   theme.error,
  }[status] ?? theme.textDisabled;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: "rgba(28,32,48,0.96)",
        backdropFilter: "blur(8px)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        zIndex: 50,
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Fallback audio element kept for safety */}
      <audio ref={audioRef} style={{ display: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <SpeakingIndicator active={isSpeaking} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "white" }}>
            Voice Session
          </div>
          <div style={{ fontSize: 12, color: statusColor, marginTop: 1 }}>
            {STATUS_LABELS[status] ?? status}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {audioBlocked && (
          <button
            onClick={handleUnblockAudio}
            style={{
              padding: "7px 16px",
              borderRadius: theme.radius,
              border: `1px solid #fbbc04`,
              background: "rgba(251,188,4,0.15)",
              color: "#fbbc04",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔇 Enable Audio
          </button>
        )}
        {isActive && (
          <button
            onClick={handleStop}
            style={{
              padding: "8px 22px",
              borderRadius: theme.radius,
              border: "none",
              background: theme.error,
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ■ Stop
          </button>
        )}
      </div>
    </div>
  );
}

function SpeakingIndicator({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            borderRadius: 2,
            background: active ? "#34a853" : "rgba(255,255,255,0.25)",
            height: active ? `${10 + ((i * 7) % 14)}px` : "6px",
            transition: "height 0.25s ease, background 0.25s ease",
            transitionDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
