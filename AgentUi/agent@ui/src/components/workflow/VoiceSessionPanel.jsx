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
  const roomRef     = useRef(null);
  const audioEls    = useRef([]);
  const [status, setStatus]             = useState("connecting");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // diagnostic state
  const [diag, setDiag] = useState({
    agentJoined: false,
    tracksSubscribed: 0,
    micPublished: false,
    lastError: null,
  });

  useEffect(() => {
    let localTrack = null;
    let cancelled  = false;
    audioEls.current = [];

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    // Track when remote participants (the agent) join
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log("[VoiceSession] Participant connected:", participant.identity);
      setDiag(d => ({ ...d, agentJoined: true }));
    });

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      console.log("[VoiceSession] TrackSubscribed kind=%s from=%s", track.kind, participant.identity);
      if (track.kind !== Track.Kind.Audio) return;

      setDiag(d => ({ ...d, tracksSubscribed: d.tracksSubscribed + 1 }));

      const el = track.attach();
      document.body.appendChild(el);
      audioEls.current.push({ track, el });
      setStatus("agent_speaking");
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      const idx = audioEls.current.findIndex(({ track: t }) => t === track);
      if (idx !== -1) {
        const { el } = audioEls.current[idx];
        track.detach(el);
        el.pause();
        el.remove();
        audioEls.current.splice(idx, 1);
      }
      setDiag(d => ({ ...d, tracksSubscribed: Math.max(0, d.tracksSubscribed - 1) }));
      if (audioEls.current.length === 0) setStatus("connected");
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus("disconnected");
    });

    (async () => {
      try {
        await room.connect(session.livekit_url, session.token);
        if (cancelled) return;
        setStatus("connected");
        console.log("[VoiceSession] Connected. Participants:", room.remoteParticipants.size);

        // Check if agent is already in room (joined before us)
        if (room.remoteParticipants.size > 0) {
          setDiag(d => ({ ...d, agentJoined: true }));
        }

        localTrack = await createLocalAudioTrack();
        if (cancelled) return;
        await room.localParticipant.publishTrack(localTrack);
        setDiag(d => ({ ...d, micPublished: true }));
        console.log("[VoiceSession] Mic published");
      } catch (err) {
        if (!cancelled) {
          console.error("[VoiceSession] Error:", err.message);
          setDiag(d => ({ ...d, lastError: err.message }));
          setStatus("disconnected");
        }
      }
    })();

    return () => {
      cancelled = true;
      localTrack?.stop();
      audioEls.current.forEach(({ track, el }) => {
        track.detach(el);
        el.pause();
        el.remove();
      });
      audioEls.current = [];
      room.disconnect();
    };
  }, [session]);

  const handleEnableAudio = async () => {
    try {
      // Must be called in user gesture — resumes AudioContext so future
      // track.attach() el.play() calls succeed automatically
      await roomRef.current?.startAudio();
      setAudioEnabled(true);
      setAudioBlocked(false);
      console.log("[VoiceSession] startAudio() succeeded");

      // Also try to play any elements already attached (agent spoke before click)
      audioEls.current.forEach(({ el }) => {
        el.muted = false;
        el.play().catch(() => {});
      });
    } catch (err) {
      console.warn("[VoiceSession] startAudio() failed:", err.message);
      setAudioBlocked(true);
    }
  };

  const handleStop = async () => {
    roomRef.current?.disconnect();
    await stopWorkflow(workflowId);
    onStop();
  };

  const isActive   = status !== "disconnected";
  const isSpeaking = status === "agent_speaking";
  const showAudioButton = isActive && (!audioEnabled || audioBlocked);

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
        background: "rgba(28,32,48,0.97)",
        backdropFilter: "blur(8px)",
        color: "white",
        zIndex: 50,
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Main bar */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
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
          {showAudioButton && (
            <button
              onClick={handleEnableAudio}
              style={{
                padding: "7px 18px",
                borderRadius: theme.radius,
                border: "1px solid #fbbc04",
                background: "rgba(251,188,4,0.18)",
                color: "#fbbc04",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                animation: "pulse 1.5s infinite",
              }}
            >
              🔊 Enable Audio
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

      {/* Diagnostic strip — always visible so we can see what's happening */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          padding: "4px 24px",
          fontSize: 10,
          color: "rgba(255,255,255,0.45)",
          display: "flex",
          gap: 20,
          fontFamily: "monospace",
        }}
      >
        <span style={{ color: diag.agentJoined ? "#34a853" : "rgba(255,255,255,0.35)" }}>
          {diag.agentJoined ? "✔ Agent joined" : "⏳ Waiting for agent"}
        </span>
        <span style={{ color: diag.micPublished ? "#34a853" : "rgba(255,255,255,0.35)" }}>
          {diag.micPublished ? "✔ Mic active" : "⏳ Mic pending"}
        </span>
        <span style={{ color: diag.tracksSubscribed > 0 ? "#34a853" : "rgba(255,255,255,0.35)" }}>
          Audio tracks: {diag.tracksSubscribed}
        </span>
        <span style={{ color: audioEnabled ? "#34a853" : "rgba(255,255,255,0.35)" }}>
          {audioEnabled ? "✔ Audio enabled" : "⚠ Audio not enabled"}
        </span>
        {diag.lastError && (
          <span style={{ color: theme.error }}>Error: {diag.lastError}</span>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
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
