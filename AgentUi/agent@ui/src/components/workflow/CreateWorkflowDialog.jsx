import React from 'react'
import { useState } from 'react';

function CreateWorkflowDialog({
  setShowNewDialog,
  newNameInput,
  setNewNameInput,
  newDescInput,
  setNewDescInput,
  confirmNewWorkflow
}) {
    
  return (

    <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 20
        }}
      >
        <div
          style={{
            background: "white",
            padding: 20,
            borderRadius: 12,
            width: 360,
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)"
          }}
        >
          <h3 style={{ marginTop: 0 }}>New Workflow</h3>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Name</label>
          <input
            value={newNameInput}
            onChange={(e) => setNewNameInput(e.target.value)}
            placeholder="Enter workflow name"
            style={{
              width: "95%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ddd",
              marginBottom: 12
            }}
          />
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Description</label>
          <textarea
            value={newDescInput}
            onChange={(e) => setNewDescInput(e.target.value)}
            placeholder="What does this workflow do?"
            rows={3}
            style={{
              width: "95%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ddd",
              marginBottom: 16,
              resize: "vertical"
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowNewDialog(false)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmNewWorkflow}
              disabled={!newNameInput.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: !newNameInput.trim() ? "#ccc" : "#111",
                color: "white",
                cursor: !newNameInput.trim() ? "not-allowed" : "pointer",
                opacity: !newNameInput.trim() ? 0.7 : 1
              }}
            >
              Create
            </button>
          </div>
        </div>
      </div>
  )
}

export default CreateWorkflowDialog
