import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import MusicCard from "../components/music/MusicCard";
import MusicPlayer from "../components/music/MusicPlayer";
import { Library as LibraryIcon, Loader } from "lucide-react";
import "./Music.css"; // Reusing Music CSS for grid layout

const Library = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("purchase") === "success") {
      alert("Music purchased successfully! Added to your library.");
      // Clean URL
      window.history.replaceState({}, "", "/library");
    }
  }, []);

  useEffect(() => {
    const fetchLibrary = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_library")
        .select(
          `
          purchased_at,
          content_uploads!inner (
            id,
            title,
            price,
            file_path,
            cover_path,
            type,
            profiles (full_name)
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("content_uploads.type", "audio") // ← ye filter sahi hai
        .order("purchased_at", { ascending: false });

      if (error) {
        console.error("Library Error:", error);
        setTracks([]);
        setLoading(false);
        return;
      }

      const formattedTracks = data.map((item) => {
        const t = item.content_uploads;
        return {
          id: t.id,
          title: t.title,
          artist: t.profiles?.full_name || "Unknown Artist",
          price: t.price,
          albumArt: t.cover_path
            ? supabase.storage.from("thumbnails").getPublicUrl(t.cover_path)
                .data.publicUrl
            : "/default-thumbnail.jpg",
          audioUrl: supabase.storage.from("content").getPublicUrl(t.file_path)
            .data.publicUrl,
          purchasedAt: item.purchased_at,
        };
      });

      setTracks(formattedTracks);
      setLoading(false);
    };

    fetchLibrary();
  }, []);

  const handlePlay = (track) => setCurrentTrack(track);

  // Handle Download Logic
  const handleDownload = async (track) => {
    const link = document.createElement("a");
    link.href = track.audioUrl;
    link.download = `${track.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    setCurrentTrack(tracks[(currentIndex + 1) % tracks.length]);
  };

  const handlePrev = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    setCurrentTrack(tracks[(currentIndex - 1 + tracks.length) % tracks.length]);
  };

  if (loading)
    return (
      <div className="text-white text-center py-20">
        <Loader className="animate-spin" /> Loading Library...
      </div>
    );

  return (
    <div className="music-page">
      <div className="music-header">
        <div>
          <h1 className="music-title flex items-center gap-3">
            <LibraryIcon size={28} /> My Library
          </h1>
          <p className="music-subtitle">{tracks.length} Tracks Owned</p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <h2>Your library is empty.</h2>
          <p>Go to the Marketplace to buy music!</p>
        </div>
      ) : (
        <div className="music-grid">
          {tracks.map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              onPlay={handlePlay}
              onPurchase={() => handleDownload(track)} // Reusing purchase button for Download
              isOwned={true} // <--- IMPORTANT PROP
            />
          ))}
        </div>
      )}

      <MusicPlayer
        currentTrack={currentTrack}
        onNext={handleNext}
        onPrev={handlePrev}
      />
    </div>
  );
};

export default Library;
