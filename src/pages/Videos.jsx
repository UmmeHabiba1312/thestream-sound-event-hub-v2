// src/pages/Videos.jsx
import React, { useState, useEffect } from "react";
import VideoSidebar from "../components/video/VideoSidebar";
import VideoCard from "../components/video/VideoCard";
import { supabase } from "../lib/supabase";
import { Upload, Plus, Radio } from "lucide-react"; // <--- Radio Icon Added
import "./Videos.css";

const Videos = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [videos, setVideos] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [videoLinkToAdd, setVideoLinkToAdd] = useState("");
  const [manualAddError, setManualAddError] = useState(null);
  const [activeStreamId, setActiveStreamId] = useState(null); // Nayi state
  const [streamKey, setStreamKey] = useState(null);
  const [rtmpUrl, setRtmpUrl] = useState("rtmp://rtmp.livepeer.studio/live");
  const [playbackId, setPlaybackId] = useState(null);

  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Technology");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [historyVideoIds, setHistoryVideoIds] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [watchLaterIds, setWatchLaterIds] = useState([]);
  const [watchLaterLoading, setWatchLaterLoading] = useState(false);
  const [likedVideoIds, setLikedVideoIds] = useState([]);
  const [likedLoading, setLikedLoading] = useState(false);
  const [trendingVideos, setTrendingVideos] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  

  const [currentUserInfo, setCurrentUserInfo] = useState({
    fullName: "You",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=You",
    userId: null,
  });

  const [userAssets, setUserAssets] = useState({
    streamingHours: 0,
    videoUploads: 0,
  });

  // 1. User Assets Fetch Karne Ka Function
  const fetchUserAssets = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("remaining_streaming_hours, remaining_video_uploads")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setUserAssets({
        streamingHours: data.remaining_streaming_hours,
        videoUploads: data.remaining_video_uploads,
      });
    }
  };

  useEffect(() => {
    if (currentUserInfo.userId) {
      fetchUserAssets(currentUserInfo.userId);
    }
  }, [currentUserInfo.userId]);

  const [channelProfile, setChannelProfile] = useState(null);

  useEffect(() => {
    if (activeCategory.startsWith("channel_")) {
      const channelId = activeCategory.split("_")[1];
      const fetchChannelProfile = async () => {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", channelId)
          .maybeSingle();
        if (!error) setChannelProfile(profile);
      };
      fetchChannelProfile();
    } else {
      setChannelProfile(null);
    }
  }, [activeCategory]);

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!user || error) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const displayName =
        profile?.full_name?.trim() || user.email?.split("@")[0] || "User";
      const avatarUrl = profile?.avatar_url
        ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data
            .publicUrl
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email || "user"}`;

      setCurrentUserInfo({ fullName: displayName, avatarUrl, userId: user.id });
    };
    fetchUser();
  }, []);

  const getVideoDuration = (file) => {
    if (!file) return Promise.resolve(0); // Safe check
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      // Error handling bhi add kar dein
      video.onerror = () => {
        resolve(0);
      };
    });
  };
  // Fetch videos
  const fetchVideos = async () => {
    const { data, error } = await supabase
      .from("videos")
      .select(
        `
        *,
        profiles (full_name),
        views:video_views (count)
      `,
      )
      // 💡 Logic Update: Normal videos approved honi chahiye,
      // lekin LIVE hamesha nazar aani chahiye
      .or("approved.eq.true,category.eq.Live")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const formatted = data.map((v) => {
        // Supabase count mapping fix
        let count = 0;
        if (Array.isArray(v.views) && v.views.length > 0) {
          count = v.views[0].count; // Agar array format mein hai
        } else if (v.views && typeof v.views === "object") {
          count = v.views.count || 0; // Agar direct object format mein hai
        }

        return {
          ...v,
          channelName: v.profiles?.full_name || "Unknown Channel",
          viewsCount: count, // ✅ Ab ye 100% value pakray ga
          duration: v.duration,
        };
      });
      setVideos(formatted);
    }
  };

  useEffect(() => {
    fetchVideos();
    const channel = supabase
      .channel("videos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        (payload) => {
          if (payload.new.approved) {
            setVideos((prev) => [payload.new, ...prev]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "videos" },
        async (payload) => {
          const { data: updatedVideo, error } = await supabase
            .from("videos")
            .select("*")
            .eq("id", payload.new.id)
            .maybeSingle();

          if (!error && updatedVideo?.approved) {
            setVideos((prev) => {
              const exists = prev.find((v) => v.id === updatedVideo.id);
              if (exists) {
                return prev.map((v) =>
                  v.id === updatedVideo.id ? updatedVideo : v,
                );
              } else {
                return [updatedVideo, ...prev];
              }
            });
          }
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (activeCategory === "history" && currentUserInfo.userId) {
      const fetchHistoryIds = async () => {
        setHistoryLoading(true);
        // views table se user ki dekhi hui videos IDs aur unka 'last_watched' time fetch karein
        const { data: viewsData, error: viewsError } = await supabase
          .from("video_views")
          .select("video_id, last_watched")
          .eq("user_id", currentUserInfo.userId)
          .order("last_watched", { ascending: false }); // Latest watched first

        if (!viewsError && viewsData) {
          // IDs ko sort karke state mein store karein
          const sortedIds = viewsData.map((v) => v.video_id);
          setHistoryVideoIds(sortedIds);
        } else if (viewsError) {
          console.error("Error fetching history IDs:", viewsError);
        }
        setHistoryLoading(false);
      };
      fetchHistoryIds();
    } else if (activeCategory !== "history") {
      // Jab user history se bahar jaye, toh IDs ko clear kar dein.
      setHistoryVideoIds([]);
    }
  }, [activeCategory, currentUserInfo.userId]);

  useEffect(() => {
    if (activeCategory === "watchlater" && currentUserInfo.userId) {
      const fetchWatchLaterIds = async () => {
        setWatchLaterLoading(true);
        const { data: viewsData, error: viewsError } = await supabase
          .from("watch_later")
          .select("video_id")
          .eq("user_id", currentUserInfo.userId)
          .order("created_at", { ascending: false }); // Latest saved first

        if (!viewsError && viewsData) {
          const ids = viewsData.map((v) => v.video_id);
          setWatchLaterIds(ids);
        } else if (viewsError) {
          console.error("Error fetching watch later IDs:", viewsError);
        }
        setWatchLaterLoading(false);
      };
      fetchWatchLaterIds();
    } else if (activeCategory !== "watchlater") {
      setWatchLaterIds([]);
    }
  }, [activeCategory, currentUserInfo.userId]);

  useEffect(() => {
    if (activeCategory === "liked" || currentUserInfo.userId) {
      // Always fetch if user logged in, to check status
      const fetchLikedIds = async () => {
        setLikedLoading(true);
        const { data, error } = await supabase
          .from("video_likes")
          .select("video_id")
          .eq("user_id", currentUserInfo.userId)
          .eq("is_like", true) // <-- SIRF LIKED VIDEOS
          .order("created_at", { ascending: false });

        if (!error && data) {
          setLikedVideoIds(data.map((v) => v.video_id));
        } else if (error) {
          console.error("Error fetching liked IDs:", error);
        }
        setLikedLoading(false);
      };
      fetchLikedIds();
    } else if (!currentUserInfo.userId) {
      setLikedVideoIds([]);
    }
  }, [activeCategory, currentUserInfo.userId]);

  const fetchTrendingVideos = async () => {
    setTrendingLoading(true);

    // 1. Trending IDs fetch karein (RPC call)
    const { data: trendingRaw, error } = await supabase.rpc(
      "get_trending_videos",
    );

    if (!error && trendingRaw) {
      // 2. Hamari main 'videos' state mein saara data pehle se hi formatted hai (channelName, viewsCount etc.)
      // Hum trending IDs ko use karke apni main list se full objects nikaal lenge
      const fullTrendingData = trendingRaw.map((tVideo) => {
        // Main videos list mein se ye video dhoondein
        const matchedVideo = videos.find((v) => v.id === tVideo.id);

        // Agar main list mein mil jaye toh full data use karein, warna original return karein
        return matchedVideo ? matchedVideo : tVideo;
      });

      setTrendingVideos(fullTrendingData);
    } else if (error) {
      console.error("Trending fetch error:", error);
    }

    setTrendingLoading(false);
  };

  useEffect(() => {
    if (activeCategory === "trending") {
      fetchTrendingVideos();
    }
  }, [activeCategory]);

  const filteredVideos =
    activeCategory === "all"
      ? videos.filter((v) => v.approved)
      : activeCategory === "live"
        ? videos.filter(
            (v) =>
              (v.category === "Live" || v.category === "Archive") && v.approved,
          )
        : activeCategory === "trending"
          ? trendingLoading && trendingVideos.length === 0
            ? [] // Loading state
            : trendingVideos
          : activeCategory === "history"
            ? historyVideoIds.length > 0
              ? historyVideoIds
                  .map((id) => videos.find((v) => v.id === id))
                  .filter((v) => v && v.approved)
              : []
            : activeCategory === "watchlater" // <--- WATCH LATER FILTER
              ? watchLaterIds.length > 0
                ? watchLaterIds
                    // IDs ke order mein videos dhundhein
                    .map((id) => videos.find((v) => v.id === id))
                    .filter((v) => v && v.approved)
                : []
              : activeCategory === "liked"
                ? likedVideoIds.length > 0
                  ? likedVideoIds
                      .map((id) => videos.find((v) => v.id === id))
                      .filter((v) => v && v.approved)
                  : []
                : activeCategory.startsWith("channel_")
                  ? videos.filter((v) => {
                      const channelId = activeCategory.split("_")[1];
                      return v.uploaded_by === channelId && v.approved;
                    })
                  : // Normal Category Filtering
                    videos.filter(
                      (v) =>
                        v.category.toLowerCase() ===
                          activeCategory.toLowerCase() && v.approved,
                    );
  // --- Helper: generate auto thumbnail ---
  const generateThumbnail = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;

      video.addEventListener("loadeddata", () => {
        video.currentTime = 1;
      });
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.Context("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/png",
          1,
        );
      });
      video.addEventListener("error", (err) => reject(err));
    });
  };

  const isVideoInWatchLater = (videoId) => {
    return watchLaterIds.includes(videoId); // Check karein ki ID state mein hai ya nahi
  };

  const handleWatchLaterToggle = async (videoId, isSaved) => {
    if (!currentUserInfo.userId) {
      alert("Please log in to manage your Watch Later list.");
      return;
    }

    // Optimistic UI Update: Turant UI mein change dikhaane ke liye
    setWatchLaterIds(
      (prevIds) =>
        isSaved
          ? prevIds.filter((id) => id !== videoId) // Remove
          : [videoId, ...prevIds], // Add
    );

    const table = "watch_later";

    try {
      if (isSaved) {
        // REMOVE from DB
        await supabase
          .from(table)
          .delete()
          .eq("user_id", currentUserInfo.userId)
          .eq("video_id", videoId);
      } else {
        // ADD to DB
        await supabase
          .from(table)
          .insert({ user_id: currentUserInfo.userId, video_id: videoId });
      }
    } catch (err) {
      console.error("Watch Later DB Error:", err);
      alert(`Failed to ${isSaved ? "remove from" : "add to"} Watch Later.`);
      // Agar DB fail ho, toh UI ko wapas revert kar dein (Rollback)
      setWatchLaterIds((prevIds) =>
        isSaved
          ? [videoId, ...prevIds]
          : prevIds.filter((id) => id !== videoId),
      );
    }
  };

  const handleManualWatchLaterAdd = async (e) => {
    e.preventDefault();
    setManualAddError(null);

    if (!currentUserInfo.userId) {
      setManualAddError("Please log in to save videos.");
      return;
    }

    // Simple logic: Assuming user enters the video ID directly
    const videoId = parseInt(videoLinkToAdd.trim());

    if (isNaN(videoId) || videoId <= 0) {
      setManualAddError("Please enter a valid Video ID (e.g., 1, 15, 100).");
      return;
    }

    // Check if video exists (optional but recommended)
    const { count, error: countError } = await supabase
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("id", videoId);

    if (countError || count === 0) {
      setManualAddError("Video not found with this ID.");
      return;
    }

    // Optimistic Update: Add to state first
    if (!watchLaterIds.includes(videoId)) {
      setWatchLaterIds((prev) => [videoId, ...prev]);
    }

    try {
      // Insert into database
      const { error } = await supabase
        .from("watch_later")
        .insert({ user_id: currentUserInfo.userId, video_id: videoId });

      if (error) throw error;

      setVideoLinkToAdd("");
      setShowManualAddModal(false);
      alert(`Video ID ${videoId} added to Watch Later!`);
    } catch (err) {
      console.error("Manual Add Error:", err);
      setManualAddError(err.message || "Failed to add video. Already added?");
      // Rollback optimistic update
      setWatchLaterIds((prev) => prev.filter((id) => id !== videoId));
    }
  };

  const isVideoLiked = (videoId) => {
    // Check karein ki video ID liked list mein hai ya nahi
    return likedVideoIds.includes(videoId);
  };

  const handleLikeToggle = async (videoId, isCurrentlyLiked) => {
    if (!currentUserInfo.userId) {
      alert("Please log in to like videos.");
      return;
    }

    // Optimistic UI Update:
    setLikedVideoIds(
      (prevIds) =>
        isCurrentlyLiked
          ? prevIds.filter((id) => id !== videoId) // Unlike (Remove)
          : [videoId, ...prevIds], // Like (Add)
    );

    try {
      if (isCurrentlyLiked) {
        // Option 1: Delete the row when unliked (Clean approach)
        const { error: deleteError } = await supabase
          .from("video_likes")
          .delete()
          .eq("user_id", currentUserInfo.userId)
          .eq("video_id", videoId);

        if (deleteError) throw deleteError;
      } else {
        // Option 2: Insert or Update to TRUE (Like)
        const { error: upsertError } = await supabase
          .from("video_likes")
          .upsert(
            {
              user_id: currentUserInfo.userId,
              video_id: videoId,
              is_like: true,
            },
            { onConflict: "user_id, video_id" }, // Unique constraint use karke
          );

        if (upsertError) throw upsertError;
      }
    } catch (err) {
      console.error("Like Toggle DB Error:", err);
      alert(`Failed to ${isCurrentlyLiked ? "unlike" : "like"} video.`);
      // Rollback optimistic update
      setLikedVideoIds((prevIds) =>
        isCurrentlyLiked
          ? [videoId, ...prevIds]
          : prevIds.filter((id) => id !== videoId),
      );
    }
  };
  // --- Functions to open Modal ---
  const openUploadModal = async () => {
    if (!currentUserInfo.userId) {
      alert("Please log in to upload.");
      return;
    }

    await fetchUserAssets(currentUserInfo.userId);

    if (userAssets.videoUploads <= 0) {
      alert(
        "Free Limit Reached: You have used your 3 free upload slots. Please upgrade to a Standard/Premium plan or purchase a 'Custom Bundle' to continue uploading.",
      );
      return;
    }

    setCategory("Technology");
    setShowUploadModal(true);
  };

  const openLiveModal = async () => {
    if (!currentUserInfo.userId) {
      alert("Please log in to start a stream.");
      return;
    }

    await fetchUserAssets(currentUserInfo.userId);

    // Check if user has streaming hours
    if (userAssets.streamingHours <= 0) {
      alert(
        "⚠️ Aapka streaming balance 0 hai. Pehle Subscription mein ja kar 'Custom Bundle' se hours khareedein!",
      );
      // Aap user ko direct subscription page par bhi bhej sakte hain:
      // window.location.href = "/subscription";
      return;
    }

    setCategory("Live");
    setUploading(true);
    setTitle("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-mux-live-stream", // Edge function ka naam same hai
        {
          body: {
            userId: currentUserInfo.userId,
            title: title || "My Live Stream",
          },
        },
      );

      if (error) throw error;
      console.log("LivePeer Full Response:", data);
      console.log("LivePeer Stream ID (data.id):", data.id);
      // ✅ LivePeer ke mutabiq state update karein
      setStreamKey(data.stream_key);
      setPlaybackId(data.playback_id);
      setActiveStreamId(data.id);

      // ✅ LivePeer ka RTMP URL
      const livepeerRtmpUrl = "rtmp://rtmp.livepeer.studio/live";
      setRtmpUrl(livepeerRtmpUrl);

      setShowUploadModal(true);

      alert(
        `Live Stream Ready!\n\nServer: ${livepeerRtmpUrl}\nStream Key: ${data.stream_key}\n\nCopy these to OBS Studio.`,
      );
    } catch (err) {
      console.error("Stream Creation Error:", err);
      alert("Failed to create stream. Check your LivePeer API Key in Secrets.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadError("");

    try {
      // 1. Auth Check
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !currentUserInfo.userId)
        throw new Error("User not authenticated");

      // 2. Asset Check (Database se latest balance mangwa kar check karein)
      const { data: profile } = await supabase
        .from("profiles")
        .select("remaining_streaming_hours, remaining_video_uploads")
        .eq("id", user.id)
        .single();

      if (category === "Live" && profile.remaining_streaming_hours <= 0) {
        throw new Error(
          "Aapka streaming balance khatam hai. Bundle khareedein!",
        );
      }
      if (category !== "Live" && profile.remaining_video_uploads <= 0) {
        throw new Error(
          "Aapke paas video upload slots khatam hain. Bundle khareedein!",
        );
      }

      // 3. Input Validation
      if (!title) {
        setUploadError("Title is required.");
        setUploading(false);
        return;
      }
      if (category !== "Live" && !videoFile) {
        setUploadError("Please select a video file for upload.");
        setUploading(false);
        return;
      }

      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      const userIp = ipData.ip;
      let insertedRecord = null;

      // =======================================================
      // A) LIVE STREAM START LOGIC
      // =======================================================
      if (category === "Live") {
        if (!streamKey || !playbackId)
          throw new Error("LivePeer assets not created.");

        const autoLiveThumbnail = `https://livepeercdn.studio/hls/${playbackId}/thumbnails/default.jpg`;

        const { data, error } = await supabase
          .from("videos")
          .insert({
            title: title || "Untitled Live Stream",
            description,
            category: "Live",
            video_url: playbackId,
            stream_id: activeStreamId,
            thumbnail_url: thumbnailFile ? null : autoLiveThumbnail,
            uploaded_by: user.id,
            uploader_ip: userIp,
            status: "approved",
            approved: true,
            stream_status: "live",
            duration: "LIVE",
          })
          .select()
          .single();

        if (error) throw error;
        insertedRecord = data;
        alert("Stream is Live!");
      }
      // =======================================================
      // B) NORMAL VIDEO UPLOAD LOGIC
      // =======================================================
      else {
        const durationInSeconds = await getVideoDuration(videoFile);

        // 1. Storage Upload
        const videoExt = videoFile.name.split(".").pop();
        const videoName = `${crypto.randomUUID()}.${videoExt}`;
        await supabase.storage.from("video").upload(videoName, videoFile);

        // 2. Thumbnail Logic (Same as before)
        let thumbnailName = null;
        if (thumbnailFile) {
          const ext = thumbnailFile.name.split(".").pop();
          thumbnailName = `${crypto.randomUUID()}.${ext}`;
          await supabase.storage
            .from("thumbnails")
            .upload(`videos_thumbnail/${thumbnailName}`, thumbnailFile);
        } else {
          const blob = await generateThumbnail(videoFile);
          if (blob) {
            const fileName = `${crypto.randomUUID()}.png`;
            await supabase.storage
              .from("thumbnails")
              .upload(`videos_thumbnail/${fileName}`, blob, {
                contentType: "image/png",
              });
            thumbnailName = fileName;
          }
        }

        // 3. Insert into DB
        const { data, error: insertError } = await supabase
          .from("videos")
          .insert({
            title,
            description,
            category,
            video_url: videoName,
            thumbnail_url: `videos_thumbnail/${thumbnailName}`,
            uploaded_by: user.id,
            uploader_ip: userIp,
            status: "pending",
            stream_status: "finished",
            duration: Math.round(durationInSeconds),
          })
          .select()
          .single();

        if (insertError) throw insertError;
        insertedRecord = data;

        // ✅ 4. DEDUCT ASSET (Video slot kam karein)
        await supabase.rpc("increment_user_assets", {
          p_user_id: user.id,
          add_streaming: 0,
          add_videos: -1,
          add_music: 0,
        });
      }

      // Final UI Update
      if (insertedRecord) {
        setVideos((prev) => [insertedRecord, ...prev]);
        fetchUserAssets(user.id); // Refresh balance display
      }
      setShowUploadModal(false);
      setVideoFile(null);
      setThumbnailFile(null);
      setTitle("");
      setDescription("");
      setCategory("Technology");
    } catch (err) {
      console.error("Upload Error:", err);
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const getChannelTitle = (activeCategory) => {
    // Expected format: 'channel_ID_NAME'
    if (activeCategory.startsWith("channel_")) {
      const parts = activeCategory.split("_");

      // Agar string mein ID aur Name dono hain (parts.length >= 3)
      if (parts.length > 2) {
        // Hum sirf Name (teesre part ya uske baad) ko lenge
        // Join '_', aur agar Name mein space tha, toh use replace karein (agar aapne VideoSidebar mein replace kiya tha)
        const namePart = parts.slice(2).join("_");
        const cleanName = namePart.replace(/~/g, " "); // Agar aapne '~' use kiya tha space ke liye

        return cleanName;
      }

      // Fallback agar sirf ID ho
      return "Channel Videos";
    }
    return "Videos"; // Default fallback
  };

  return (
    <div className="videos-page">
         <VideoSidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="videos-content">
        <div className="videos-header">
          <div>
            <h1 className="videos-title">
              {activeCategory === "all"
                ? "All Videos"
                : activeCategory.startsWith("channel_") // Check karein agar yeh channel filter hai
                  ? getChannelTitle(activeCategory) // <-- Naya Function Call
                  : activeCategory.charAt(0).toUpperCase() +
                    activeCategory.slice(1)}
            </h1>
            <p className="videos-subtitle">
              {filteredVideos.length} videos available
            </p>
          </div>

          {/* --- NEW BUTTONS SECTION --- */}
          <div style={{ display: "flex", gap: "12px" }}>
            {activeCategory === "watchlater" && currentUserInfo.userId && (
              <button
                className="manual-add-btn"
                onClick={() => {
                  setVideoLinkToAdd(""); // Clear previous input
                  setShowManualAddModal(true);
                }}
                style={{
                  // Thodi inline styling, aap CSS mein daal sakte hain
                  background: "#007bff",
                  color: "white",
                  padding: "8px 16px",
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={20} style={{ marginRight: 5 }} /> Add Video Manually
              </button>
            )}
            <button className="live-btn" onClick={openLiveModal}>
              <Radio size={20} /> Go Live
            </button>
            <button className="upload-btn" onClick={openUploadModal}>
              <Plus size={20} /> Upload Video
            </button>
          </div>
        </div>

        <div className="videos-grid">
          {filteredVideos.map((video) => {
            const isLiveCategory = video.category === "Live";
            const isCurrentlyLive =
              video.stream_status === "live" ||
              video.stream_status === "active";
            const videoUrlFromDB = video.video_url || "";

            // ==========================================
            // 1. ✅ VIDEO URL LOGIC
            // ==========================================
            let finalVideoUrl = "";
            if (videoUrlFromDB.includes("https://")) {
              // Edge Function wala full link
              finalVideoUrl = videoUrlFromDB;
            } else if (isLiveCategory) {
              if (isCurrentlyLive) {
                finalVideoUrl = `https://livepeercdn.studio/hls/${videoUrlFromDB}/index.m3u8`; // Yeh sahi URL hai live ke liye (logs se match)
              } else {
                // Recorded fallback for Catalyst
                finalVideoUrl = `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${videoUrlFromDB}/index.m3u8`;
              }
            } else {
              // Normal Video logic: Supabase storage se poora link lein
              finalVideoUrl = supabase.storage
                .from("video")
                .getPublicUrl(videoUrlFromDB).data.publicUrl;
            }

            // ==========================================
            // 2. ✅ UPDATED THUMBNAIL URL LOGIC
            let finalThumbnailUrl = "/live_placeholder.png";

            if (video.thumbnail_url) {
              // Agar DB mein link mojood hai (Live start ya Recording ready dono cases mein)
              if (video.thumbnail_url.startsWith("http")) {
                finalThumbnailUrl = video.thumbnail_url;
              } else {
                // Normal uploaded videos ke liye storage path
                const fullPath = video.thumbnail_url.includes(
                  "videos_thumbnail/",
                )
                  ? video.thumbnail_url
                  : `videos_thumbnail/${video.thumbnail_url}`;
                finalThumbnailUrl = supabase.storage
                  .from("thumbnails")
                  .getPublicUrl(fullPath).data.publicUrl;
              }
            } else if (isLiveCategory) {
              // Agar DB khali ho toh foran auto-construct karein
              if (videoUrlFromDB.includes("https://")) {
                finalThumbnailUrl = videoUrlFromDB.replace(
                  "index.m3u8",
                  "thumbnails/default.jpg",
                );
              } else {
                finalThumbnailUrl = `https://livepeercdn.studio/hls/${videoUrlFromDB}/thumbnails/default.jpg`;
              }
            }
            return (
              <VideoCard
                key={video.id}
                video={{
                  ...video,
                  videoUrl: finalVideoUrl,
                  thumbnailUrl: finalThumbnailUrl,
                  duration: isLiveCategory
                    ? isCurrentlyLive
                      ? "LIVE"
                      : "REC"
                    : video.duration || "00:00",
                }}
                onChannelClick={() => navigate(`/user/${video.uploaded_by}`)}
              />
            );
          })}
        </div>

        {showUploadModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowUploadModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">
                {category === "Live"
                  ? "Go Live (Upload Stream)"
                  : "Upload Video"}
              </h2>
              {uploadError && (
                <p className="text-red-500 text-center font-bold mb-4">
                  {uploadError}
                </p>
              )}

              <form onSubmit={handleUpload}>
                {category === "Live" && streamKey && (
                  <div className="stream-key-info p-4 bg-gray-700 rounded-lg mb-4 text-white">
                    <p className="font-bold text-lg mb-3">
                      Your Stream Details:
                    </p>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">RTMP Server URL:</span>
                      <code className="bg-gray-800 p-1 rounded text-green-400 select-all">
                        {rtmpUrl}
                      </code>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">
                        Stream Key (Secret):
                      </span>
                      <code className="bg-gray-800 p-1 rounded text-red-400 select-all">
                        {streamKey}
                      </code>
                    </div>

                    <p className="text-sm mt-3 text-gray-400">
                      Copy these details into OBS/Streamlabs and start
                      streaming.
                    </p>
                  </div>
                )}

                {category !== "Live" && (
                  <>
                    <div className="upload-area">
                      <Upload size={48} className="upload-icon" />
                      <h3 className="upload-text">Select Video</h3>
                      <input
                        type="file"
                        className="file-input"
                        accept="video/*"
                        onChange={(e) => setVideoFile(e.target.files[0])}
                        required
                      />
                    </div>
                    <div className="upload-area">
                      <Upload size={48} className="upload-icon" />
                      <h3 className="upload-text">
                        Select Thumbnail (Optional)
                      </h3>
                      <input
                        type="file"
                        className="file-input"
                        accept="image/*"
                        onChange={(e) => setThumbnailFile(e.target.files[0])}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input"
                    placeholder="Enter video title"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-textarea"
                    rows={4}
                    placeholder="Enter video description"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                  >
                    <option>Technology</option>
                    <option>Gaming</option>
                    <option>Music</option>
                    <option>Education</option>
                    <option>Entertainment</option>
                    <option>Movies</option>
                    <option>Live</option> {/* Live option included */}
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn cancel"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="modal-btn submit"
                    disabled={uploading}
                  >
                    {uploading
                      ? "Uploading..."
                      : category === "Live"
                        ? "Start Stream"
                        : "Upload Video"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showManualAddModal && (
          <div
            className="modal-overlay"
            // Cancel button ya overlay click hone par band karein
            onClick={() => setShowManualAddModal(false)}
          >
            <div
              className="modal-content"
              // Modal ke andar click hone par overlay click ko rokein
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="modal-title">Add Video to Watch Later</h2>
              {manualAddError && (
                <p className="text-red-500 text-center font-bold mb-4">
                  {manualAddError}
                </p>
              )}

              {/* Form submit hone par handleManualWatchLaterAdd function call hoga */}
              <form onSubmit={handleManualWatchLaterAdd}>
                <div className="form-group">
                  <label className="form-label">Video ID</label>
                  <input
                    type="text"
                    value={videoLinkToAdd}
                    onChange={(e) => setVideoLinkToAdd(e.target.value)}
                    className="form-input"
                    placeholder="Enter Video ID (e.g., 123)"
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="modal-btn cancel"
                    onClick={() => setShowManualAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="modal-btn submit">
                    Add to List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Videos;
