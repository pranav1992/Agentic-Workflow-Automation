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
  const roomRef          = useRef(null);
  const audioEls         = useRef([]);  // [{ track, el }]
  const [status, setStatus]           = useState("connecting");
  // audioEnabled: user has clicked the button at least once (gesture captured)
  const [audioEnabled, setAudioEnabled] = useState(false);
  // audioBlocked: livekit says playback still can't happen even after enabling
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let localTrack = null;
    let cancelled  = false;
    audioEls.current = [];

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      // livekit tells us playback is blocked — show button again
      setAudioBlocked(!room.canPlaybackAudio);
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind !== Track.Kind.Audio) return;

      // track.attach() creates the element, sets srcObject, and internally
      // calls el.play(). Do NOT call el.play() again — a second call aborts
      // the first one with AbortError, which livekit silently ignores,
      // preventing AudioPlaybackFailed / AudioPlaybackStatusChanged from firing.
      // Do NOT override el.muted / el.volume here either — livekit may be
      // routing audio through the Web Audio API and sets muted=true intentionally.
      const el = track.attach();
      document.body.appendChild(el);
      audioEls.current.push({ track, el });

      console.log("[VoiceSession] TrackSubscribed", track.kind, track.sid);
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
        console.log("[VoiceSession] Connected to room");

        localTrack = await createLocalAudioTrack();
        if (cancelled) return;
        await room.localParticipant.publishTrack(localTrack);
        console.log("[VoiceSession] Mic published");
      } catch (err) {
        if (!cancelled) {
          console.error("[VoiceSession] Connection error:", err.message);
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

  // Called when the user clicks "Enable Audio" — MUST happen in a user gesture
  // so room.startAudio() can resume the AudioContext and allow el.play().
  const handleEnableAudio = async () => {
    try {
      await roomRef.current?.startAudio();
      setAudioEnabled(true);
      setAudioBlocked(false);
      console.log("[VoiceSession] Audio enabled via startAudio()");
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

  // Show the button if audio hasn't been enabled yet, or if livekit re-blocked it
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
        {showAudioButton && (
          <button
            onClick={handleEnableAudio}
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
