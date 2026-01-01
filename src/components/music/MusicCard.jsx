import React, { useState, useEffect } from "react";
import {
  Play,
  Heart,
  ShoppingCart,
  TrendingUp,
  Download,
  Check,
} from "lucide-react"; // Added Download, Check
import { supabase } from "../../lib/supabase";
import "./MusicCard.css";

const MusicCard = ({ track, onPlay, onPurchase, isOwned = false }) => {
  // Added isOwned prop
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // 1. Fetch Stats on Load
  useEffect(() => {
    const fetchStats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Get Likes
      const { count: lCount } = await supabase
        .from("content_likes")
        .select("*", { count: "exact", head: true })
        .eq("content_id", track.id);
      setLikesCount(lCount || 0);

      // Get Views
      const { count: vCount } = await supabase
        .from("content_views")
        .select("*", { count: "exact", head: true })
        .eq("content_id", track.id);
      setViewsCount(vCount || 0);

      // Check if User Liked
      if (user) {
        const { data } = await supabase
          .from("content_likes")
          .select("id")
          .eq("content_id", track.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsLiked(!!data);
      }
    };
    fetchStats();
  }, [track.id]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!currentUser) return alert("Please login to like!");
    const oldState = isLiked;
    setIsLiked(!isLiked);
    setLikesCount((prev) => (!oldState ? prev + 1 : prev - 1));

    const { data, error } = await supabase.rpc("toggle_content_like", {
      p_content_id: track.id,
      p_user_id: currentUser.id,
    });
    if (error) setIsLiked(oldState);
    else if (data && data[0]) {
      setLikesCount(data[0].likes_count);
      setIsLiked(data[0].is_liked);
    }
  };

  // 3. Handle Play (Unique View Logic - FIXED)
  const handlePlayClick = async () => {
    // 1. Music turant play karein
    onPlay(track);

    // Agar guest user hai, toh views count mat badhao (ya badhao, apki marzi)
    if (!currentUser) return;

    try {
      // 2. Check if view exists
      const { data: existingView, error: fetchError } = await supabase
        .from("content_views")
        .select("id")
        .eq("content_id", track.id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Fetch view error:", fetchError);
        return;
      }

      // 3. Agar view NAHI hai, tabhi insert karo aur count badhao
      if (!existingView) {
        const { error: insertError } = await supabase
          .from("content_views")
          .insert({
            content_id: track.id,
            user_id: currentUser.id,
          });

        if (!insertError) {
          setViewsCount((prev) => prev + 1);
        } else {
          console.error("Insert view error:", insertError);
        }
      } else {
        console.log("View already counted for this user.");
      }
    } catch (err) {
      console.error("View Count Logic Error:", err);
    }
  };

  return (
    <div className="music-card hover-lift">
      <div className="album-art-wrapper">
        <img src={track.albumArt} alt={track.title} className="album-art" />
        <button className="play-overlay" onClick={handlePlayClick}>
          <Play size={32} fill="white" />
        </button>

        {/* If Owned, show Checkmark, else show Price */}
        <div className={`track-price ${isOwned ? "owned-badge" : ""}`}>
          {isOwned ? <Check size={14} /> : `$${track.price}`}
        </div>
      </div>

      <div className="music-info">
        <h3 className="track-title">{track.title}</h3>
        <p className="artist-name">{track.artist}</p>

        <div className="track-stats">
          <span className="stat-item">
            <TrendingUp size={14} />
            {viewsCount.toLocaleString()}
          </span>
          <span className="stat-separator">•</span>
          <span className="stat-item">
            <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
            {likesCount.toLocaleString()}
          </span>
        </div>

        <div className="track-actions">
          <button
            className={`action-btn like-btn ${isLiked ? "active" : ""}`}
            onClick={handleLike}
          >
            <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
          </button>

          {/* DYNAMIC BUTTON: Buy Now vs Download */}
          <button
            className={`action-btn ${isOwned ? "download-btn" : "purchase-btn"}`}
            onClick={() => onPurchase(track)}
            style={
              isOwned ? { backgroundColor: "#3ea6ff", color: "black" } : {}
            }
          >
            {isOwned ? <Download size={16} /> : <ShoppingCart size={16} />}
            <span>{isOwned ? "Download" : "Buy Now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MusicCard;
