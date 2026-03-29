import React, { useState } from "react";
import "./LiveStreamForm.css";

const LiveStreamForm = ({ onConfirm }) => {
  const [eventName, setEventName] = useState("");
  const [streamType, setStreamType] = useState("music");
  const [expectedHours, setExpectedHours] = useState("");
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!agreed) {
      alert("Please confirm payment authorization");
      return;
    }

    onConfirm({
      eventName,
      streamType,
      expectedHours,
    });
  };

  return (
    <div className="ls-overlay">
      <form className="ls-form" onSubmit={handleSubmit}>
        <h2>Start Live Streaming</h2>

        <label>Event / Stream Name</label>
        <input
          type="text"
          placeholder="Live Concert / Wedding Event"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          required
        />

        <label>Streaming Type</label>
        <select
          value={streamType}
          onChange={(e) => setStreamType(e.target.value)}
        >
          <option value="music">Music Live</option>
          <option value="event">Event Live</option>
        </select>

        <label>Expected Streaming Duration (Hours)</label>
        <input
          type="number"
          min="1"
          placeholder="e.g. 2"
          value={expectedHours}
          onChange={(e) => setExpectedHours(e.target.value)}
          required
        />

        <div className="ls-note">
          You will be charged based on actual streaming time.
          Payment is authorized before going live.
        </div>

        <div className="ls-check">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>I authorize payment for live streaming</span>
        </div>

        <button type="submit">Confirm & Go Live</button>
      </form>
    </div>
  );
};

export default LiveStreamForm;
