import React, { useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
  Track,
} from "livekit-client";
import { stopWorkflow } from "../../api/workflow";

const STATUS_LABELS = {
  connecting: "Connecting…",
  connected: "Listening",
  agent_speaking: "Agent speaking",
  disconnected: "Disconnected",
};

export default function VoiceSessionPanel({ workflowId, session, onStop }) {
  const roomRef = useRef(null);
  const audioRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let localTrack = null;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        track.attach(audioRef.current);
        setStatus("agent_speaking");
        track.on("audioPlaybackStarted", () => setStatus("agent_speaking"));
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach();
        setStatus("connected");
      }
    });

    room.on(RoomEvent.Disconnected, () => setStatus("disconnected"));

    (async () => {
      await room.connect(session.livekit_url, session.token);
      setStatus("connected");
      localTrack = await createLocalAudioTrack();
      await room.localParticipant.publishTrack(localTrack);
    })();

    return () => {
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

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        background: "#111",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        zIndex: 10,
        borderTop: "2px solid #333",
      }}
    >
      <audio ref={audioRef} autoPlay style={{ display: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SpeakingIndicator active={status === "agent_speaking"} />
        <span style={{ fontSize: 14, opacity: 0.9 }}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {isActive && (
        <button
          onClick={handleStop}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: "#ef4444",
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Stop
        </button>
      )}
    </div>
  );
}

function SpeakingIndicator({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            borderRadius: 2,
            background: active ? "#22c55e" : "#555",
            height: active ? 16 + i * 6 : 8,
            transition: "height 0.2s ease",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
