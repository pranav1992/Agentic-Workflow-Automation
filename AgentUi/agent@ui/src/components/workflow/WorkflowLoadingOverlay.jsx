import React from "react";

export default function WorkflowLoadingOverlay({ show, message = "Loading workflow…" }) {
  if (!show) return null;
  return (
    <div className="wf-builder-loading">
      <div className="wf-builder-loading-card">
        <div className="wf-builder-spinner" />
        <div className="wf-builder-caption">{message}</div>
        <div className="wf-builder-lines">
          <div className="wf-builder-line short" />
          <div className="wf-builder-line" />
          <div className="wf-builder-line tiny" />
        </div>
      </div>
    </div>
  );
}
