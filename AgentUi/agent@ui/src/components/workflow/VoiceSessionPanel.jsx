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
  connecting:    "Connecting…",
  connected:     "Listening",
  agent_speaking:"Agent speaking",
  disconnected:  "Disconnected",
};

export default function VoiceSessionPanel({ workflowId, session, onStop }) {
  const roomRef = useRef(null);
  const audioRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let localTrack = null;
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach(audioRef.current);
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
      room.disconnect();
    };
  }, [session]);

  const handleStop = async () => {
    roomRef.current?.disconnect();
    await stopWorkflow(workflowId);
    onStop();
  };

  const isActive = status !== "disconnected";
  const isSpeaking = status === "agent_speaking";

  const statusColor = {
    connecting:    theme.textDisabled,
    connected:     "#34a853",
    agent_speaking:"#fbbc04",
    disconnected:  theme.error,
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
        borderTop: `1px solid rgba(255,255,255,0.1)`,
      }}
    >
      <audio ref={audioRef} autoPlay style={{ display: "none" }} />

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
            letterSpacing: "0.2px",
          }}
        >
          ■ Stop
        </button>
      )}
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
