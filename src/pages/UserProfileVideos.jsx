import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import VideoCard from "../components/video/VideoCard";
import { Trash2, Edit2 } from "lucide-react";
import "./UserProfile.css";

export const UserProfileVideos = ({ userId }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch Videos
  const fetchVideos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("videos")
      .select(
        `
              *,
              views:video_views (count)
            `,
      )
      .eq("uploaded_by", userId)
      .order("created_at", { ascending: false });

    if (data) {
      const formatted = data.map((v) => ({
        ...v,
        viewsCount: v.views && v.views[0] ? v.views[0].count : 0,
        videoUrl: supabase.storage.from("video").getPublicUrl(v.video_url).data
          .publicUrl,
        thumbnailUrl: v.thumbnail_url
          ? supabase.storage.from("thumbnails").getPublicUrl(v.thumbnail_url)
              .data.publicUrl
          : "/default-thumbnail.jpg",
      }));
      console.log("Fetched videos:", formatted);

      setVideos(formatted);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchVideos();
  }, [userId]);

  // --- DELETE VIDEO LOGIC ---
  const handleDelete = async (video) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;

    try {
      // 1️⃣ Delete all dependent video_views first
      const { error: viewsError } = await supabase
        .from("video_views")
        .delete()
        .eq("video_id", video.id);

      if (viewsError) throw viewsError;

      // 2️⃣ Delete the video row
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", video.id);

      if (error) throw error;

      // 3️⃣ Delete video files from storage (optional)
      if (video.video_url) {
        await supabase.storage.from("video").remove([video.video_url]);
      }
      if (video.thumbnail_url) {
        await supabase.storage.from("thumbnails").remove([video.thumbnail_url]);
      }

      // 4️⃣ Update UI
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      alert("Video deleted successfully!");
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Failed to delete video. Check console for details.");
    }
  };

  // --- EDIT VIDEO LOGIC (Simple Title Edit) ---
  const handleEdit = async (videoId, oldTitle) => {
    const newTitle = prompt("Enter new title:", oldTitle);
    if (!newTitle || newTitle === oldTitle) return;

    try {
      const { error } = await supabase
        .from("videos")
        .update({ title: newTitle })
        .eq("id", videoId);

      if (error) throw error;

      // Update UI
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, title: newTitle } : v)),
      );
    } catch (err) {
      console.error("Edit Error:", err);
      alert("Failed to update title.");
    }
  };

  if (loading) return <p className="text-white">Loading videos...</p>;
  if (videos.length === 0)
    return <p className="text-gray-500">No videos uploaded yet.</p>;

return (
  <div className="container-fluid">
    <div className="row g-4">
      {videos.map((video) => (
        <div
          key={video.id}
          className="col-12 col-sm-6 col-md-4"
        >
          <div
            className="video-item-wrapper"
            style={{ position: "relative" }}
          >
            {/* Video Card */}
            <VideoCard video={video} />

            {/* Action Buttons */}
            <div
              className="video-actions-overlay"
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => handleEdit(video.id, video.title)}
                style={{
                  background: "#333",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  color: "white",
                }}
                title="Edit Title"
              >
                <Edit2 size={16} />
              </button>

              <button
                onClick={() => handleDelete(video)}
                style={{
                  background: "#ef4444",
                  border: "none",
                  padding: "4px 10px",
                  alignItems:"center",
                  borderRadius: "50%",
                  cursor: "pointer",
                  color: "white",
                }}
                title="Delete Video"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

};
