import React, { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  ConnectionState,
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
  const roomRef              = useRef(null);
  const [status, setStatus]  = useState("connecting");
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let localTrack    = null;
    let cancelled     = false;
    const audioEls    = [];      // el elements for cleanup

    const room = new Room();
    roomRef.current = room;

    // livekit-client 2.x: fires when browser blocks/unblocks audio
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;

      // Use raw MediaStreamTrack → HTMLAudioElement to avoid
      // livekit attach() version quirks and browser autoplay issues
      const el = new Audio();
      el.srcObject = new MediaStream([track.mediaStreamTrack]);
      el.autoplay  = true;
      el.muted     = false;
      el.volume    = 1;
      document.body.appendChild(el);
      audioEls.push(el);

      el.play().catch(() => setAudioBlocked(true));
      setStatus("agent_speaking");
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;
      // Pause and remove matching audio element(s)
      const ms = track.mediaStreamTrack;
      for (let i = audioEls.length - 1; i >= 0; i--) {
        const el = audioEls[i];
        const src = el.srcObject;
        if (src instanceof MediaStream && src.getTracks().includes(ms)) {
          el.pause();
          el.srcObject = null;
          el.remove();
          audioEls.splice(i, 1);
        }
      }
      setStatus("connected");
    });

    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) setStatus("disconnected");
    });

    (async () => {
      try {
        await room.connect(session.livekit_url, session.token);
        if (cancelled) return;
        setStatus("connected");

        // Resume Web Audio context — safe here because we're still in
        // the microtask chain started by the "Launch" button click
        await room.startAudio();

        localTrack = await createLocalAudioTrack();
        if (cancelled) return;
        await room.localParticipant.publishTrack(localTrack);
      } catch (err) {
        // "Client initiated disconnect" is React StrictMode dev noise — ignore
        if (!cancelled) {
          console.error("LiveKit connection error:", err.message);
          setStatus("disconnected");
        }
      }
    })();

    return () => {
      cancelled = true;
      localTrack?.stop();
      audioEls.forEach((el) => {
        el.pause();
        el.srcObject = null;
        el.remove();
      });
      audioEls.length = 0;
      // Skip disconnect only if room never started connecting (e.g. StrictMode
      // fires cleanup before connect() is even called). Once connecting/connected
      // we must disconnect or the zombie room leaves a broken WebRTC peer on
      // the next mount.
      if (room.state !== ConnectionState.Disconnected) {
        room.disconnect();
      }
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

  const isActive   = status !== "disconnected";
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
              border: "1px solid #fbbc04",
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
