import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  Circle,
  Check,
  MoreVertical,
  ThumbsUp,
  Eye,
} from "lucide-react";
import "./VideoCard.css";

const VideoCard = ({
  video,
  onWatchLaterToggle,
  isWatchLater,
  onLikeToggle, // <-- NEW PROP 1
  isLiked,
}) => {
  const navigate = useNavigate();
  // const [channelInfo, setChannelInfo] = useState({ name: "", avatar: "" });
  // VideoCard.jsx ke andar formatDuration function ko is se badal dein:
  const formatDuration = (val) => {
    if (val === "LIVE" || val === "REC") return val;
    // Agar value string hai toh number mein convert karein
    const seconds = parseInt(val, 10);

    if (!seconds || isNaN(seconds)) return "00:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  return (
    <div
      className="video-card hover-lift"
      onClick={() => navigate(`/video/${video.id}`)}
    >
      <div className="video-thumbnail-wrapper" style={{ position: "relative" }}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="video-thumbnail"
          // Agar URL kharab ho ya image na milay toh placeholder dikhao
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/live_placeholder.png";
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            right: "8px",
            display: "flex",
            gap: "5px",
          }}
        >
          {video.duration === "LIVE" ? (
            <span
              style={{
                backgroundColor: "rgba(255,0,0,0.8)", // Red for Live
                color: "white",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <Circle size={6} fill="white" className="pulse" /> LIVE
            </span>
          ) : (
            <span
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.8)", // Black for REC and normal videos
                color: "white",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Clock size={12} />
              {formatDuration(video.duration)}
            </span>
          )}
        </div>

        {/* Buttons Group: Isay Top-Right (Right: 8px) par ek column mein rakhein */}
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 10,
          }}
        >
          {/* Like Button */}
          {onLikeToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLikeToggle(video.id, isLiked);
              }}
              style={{
                background: isLiked ? "#007bff" : "rgba(0,0,0,0.7)",
                color: "white",
                border: "none",
                padding: "5px",
                borderRadius: "4px",
              }}
            >
              <ThumbsUp size={16} />
            </button>
          )}

          {/* Watch Later Button */}
          {onWatchLaterToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWatchLaterToggle(video.id, isWatchLater);
              }}
              style={{
                background: isWatchLater ? "#ff0000" : "rgba(0,0,0,0.7)",
                color: "white",
                border: "none",
                padding: "5px",
                borderRadius: "4px",
              }}
            >
              {isWatchLater ? <Check size={16} /> : <Clock size={16} />}
            </button>
          )}
        </div>
      </div>
      <div className="video-info">
        <h3 className="video-title">{video.title}</h3>

        {/* 1. Channel Name (VideoPlayer ki tarah) */}
        <p className="video-channel">{video.channelName}</p>

        {/* 2. Views aur Time (VideoPlayer helper ki tarah) */}
        <div
          className="video-meta"
          style={{
            display: "flex",
            gap: "8px",
            fontSize: "12px",
            color: "#888",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Eye size={14} />{" "}
            {/* Icon size chota rakha hai taake text se match kare */}
            {video.viewsCount || 0} views
          </span>
          <span>•</span>
          <span>{new Date(video.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {/* 3. Duration (Thumbnail ke upar) */}
      {video.category !== "Live" && (
        <span
          className="duration-tag"
          style={{
            position: "absolute",
            bottom: "5px",
            right: "5px",
            background: "black",
            color: "white",
            padding: "2px 4px",
            fontSize: "10px",
          }}
        ></span>
      )}
    </div>
  );
};

export default VideoCard;
