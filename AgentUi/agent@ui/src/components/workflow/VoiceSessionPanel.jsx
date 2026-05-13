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
  // Stored as ref so handleUnblockAudio can replay them outside the effect closure
  const audioEls    = useRef([]);  // [{ track, el }]
  const [status, setStatus]         = useState("connecting");
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let localTrack = null;
    let cancelled  = false;
    audioEls.current = [];

    const room = new Room();
    roomRef.current = room;

    // livekit fires this when its AudioManager detects playback is blocked/unblocked
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;

      // track.attach() creates an element livekit's AudioManager knows about,
      // so room.startAudio() (called from handleUnblockAudio) will play it.
      const el = track.attach();
      el.muted  = false;
      el.volume = 1;
      document.body.appendChild(el);
      audioEls.current.push({ track, el });

      // Attempt immediate play; browser may block this if there was no recent
      // user gesture — the AudioPlaybackStatusChanged handler will surface the
      // "Enable Audio" button in that case.
      el.play().catch(() => setAudioBlocked(true));
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

        // Resume livekit's AudioContext so future track.attach() elements can play
        await room.startAudio();

        localTrack = await createLocalAudioTrack();
        if (cancelled) return;
        await room.localParticipant.publishTrack(localTrack);
      } catch (err) {
        if (!cancelled) {
          console.error("LiveKit connection error:", err.message);
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

  const handleUnblockAudio = async () => {
    // room.startAudio() resumes livekit's AudioContext AND plays all elements
    // that were created via track.attach() — this is why we use attach() above.
    await roomRef.current?.startAudio();
    // Belt-and-suspenders: explicitly replay any element that stalled
    audioEls.current.forEach(({ el }) => el.play().catch(() => {}));
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
