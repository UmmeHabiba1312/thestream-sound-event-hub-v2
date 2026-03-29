import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import MusicCard from "../components/music/MusicCard";
import MusicPlayer from "../components/music/MusicPlayer";
import { Trash2, Edit2 } from "lucide-react";

export const UserProfileMusic = ({ userId }) => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);

  // ================= FETCH MUSIC =================
  const fetchMusic = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_uploads")
        .select("*, profiles(full_name)")
        .eq("uploaded_by", userId)
        .eq("type", "audio")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setTracks(
          data.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.profiles?.full_name || "Unknown",
            price: t.price,
            albumArt: t.cover_path
              ? supabase.storage
                  .from("thumbnails")
                  .getPublicUrl(t.cover_path).data.publicUrl
              : "/default-thumbnail.jpg",
            audioUrl: supabase.storage
              .from("content")
              .getPublicUrl(t.file_path).data.publicUrl,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching music:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (userId) fetchMusic();
  }, [userId]);

  // ================= PLAY =================
  const handlePlay = (track) => {
    setCurrentTrack(track);
  };

  // ================= NEXT / PREV =================
  const handleNext = () => {
    if (!currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    if (index < tracks.length - 1) {
      setCurrentTrack(tracks[index + 1]);
    }
  };

  const handlePrev = () => {
    if (!currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    if (index > 0) {
      setCurrentTrack(tracks[index - 1]);
    }
  };

  // ================= DELETE =================
  const handleDelete = async (track) => {
    if (!window.confirm("Are you sure you want to delete this track?")) return;

    try {
      const { error } = await supabase
        .from("content_uploads")
        .delete()
        .eq("id", track.id);

      if (error) throw error;

      setTracks((prev) => prev.filter((t) => t.id !== track.id));
      if (currentTrack?.id === track.id) setCurrentTrack(null);

      alert("Track deleted successfully!");
    } catch (err) {
      console.error("Delete Error:", err);
      alert("Failed to delete track.");
    }
  };

  // ================= EDIT =================
  const handleEdit = async (track) => {
    const newTitle = prompt("Enter new title:", track.title);
    if (!newTitle) return;

    try {
      const { error } = await supabase
        .from("content_uploads")
        .update({ title: newTitle })
        .eq("id", track.id);

      if (error) throw error;

      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id ? { ...t, title: newTitle } : t
        )
      );
    } catch (err) {
      console.error("Edit Error:", err);
      alert("Failed to update track.");
    }
  };

  if (loading) return <p className="text-white">Loading music...</p>;
  if (!tracks.length)
    return <p className="text-gray-500">No music uploaded yet.</p>;

  return (
    <div style={{ paddingBottom: currentTrack ? "140px" : "0" }}>
      {/* ================= MUSIC GRID ================= */}
      <div
        className="profile-music-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {tracks.map((track) => (
          <div
            key={track.id}
            style={{
              background: "#1e1e1e",
              borderRadius: "12px",
              padding: "15px",
            }}
          >
            <MusicCard track={track} onPlay={() => handlePlay(track)} />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "15px",
                borderTop: "1px solid #333",
                paddingTop: "10px",
              }}
            >
              <button
                onClick={() => handleEdit(track)}
                style={{
                  background: "#333",
                  border: "none",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
              >
                <Edit2 size={14} /> Edit
              </button>

              <button
                onClick={() => handleDelete(track)}
                style={{
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ================= EXISTING MUSIC PLAYER ================= */}
      <MusicPlayer
        currentTrack={currentTrack}
        onNext={handleNext}
        onPrev={handlePrev}
        onClose={() => setCurrentTrack(null)}
      />
    </div>
  );
};
