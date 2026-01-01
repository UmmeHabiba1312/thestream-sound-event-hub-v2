import React, { useState, useEffect } from "react";
import MusicCard from "../components/music/MusicCard";
import MusicPlayer from "../components/music/MusicPlayer";
import { useNavigate } from "react-router-dom"; // ← Ye line top par add kar do (already hai Videos mein)
import { supabase } from "../lib/supabase";
import "./Music.css";
import { Upload, Search, Filter, AlertTriangle } from "lucide-react";
const Music = () => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBanned, setIsBanned] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Pop");
  const [price, setPrice] = useState("2.99");
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const navigate = useNavigate();
  // User Stats
  const [uploadCount, setUploadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [userId, setUserId] = useState(null); // Explicit userId state
  const [user, setUser] = useState(null);
  // 1. Fetch Tracks & User Info
  useEffect(() => {
    const fetchTracksAndSubscription = async () => {
      const { data: userAuth } = await supabase.auth.getUser();
      const user = userAuth?.user;
      if (user) {
        setUserId(user.id);
        setUser(userAuth.user);
        // Count uploads
        const { count } = await supabase
          .from("content_uploads")
          .select("*", { count: "exact", head: true })
          .eq("uploaded_by", user.id)
          .in("status", ["pending", "approved"]);
        setUploadCount(count || 0);
        // Check subscription
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        setIsSubscribed(sub?.status === "active");
      }
      // Fetch Music
      const { data, error } = await supabase
        .from("content_uploads")
        .select("*, profiles (full_name)")
        .eq("status", "approved")
        .eq("type", "audio")
        .order("created_at", { ascending: false });
      if (error) console.error("Fetch Error:", error);
      if (data) {
        setTracks(
          data.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.profiles?.full_name || "Unknown Artist",
            artist_id: t.uploaded_by, // ← Ye add karo
            price: t.price,
            albumArt: t.cover_path
              ? supabase.storage.from("thumbnails").getPublicUrl(t.cover_path)
                  .data.publicUrl
              : "/default-thumbnail.jpg",
            audioUrl: supabase.storage.from("content").getPublicUrl(t.file_path)
              .data.publicUrl,
          })),
        );
      }
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("stripe_account_id")
          .eq("id", user.id)
          .single();
        setStripeConnected(!!profile?.stripe_account_id);
      }
      // New: Check for stripe_connected query param after redirect
      const params = new URLSearchParams(window.location.search);
      if (params.has("stripe_connected")) {
        // Refetch profile to update stripeConnected
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_account_id")
            .eq("id", user.id)
            .single();
          setStripeConnected(!!profile?.stripe_account_id);
          // Optional: Clear query param from URL (clean history)
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.hash,
          );
        }
      }
    };
    fetchTracksAndSubscription();
    const channel = supabase
      .channel("content_uploads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_uploads" },
        fetchTracksAndSubscription,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  useEffect(() => {
    const checkIfBanned = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("banned")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Ban check error:", error);
        return;
      }
      if (profile?.banned) {
        setIsBanned(true);
        alert("Your account is permanently banned. You cannot upload music.");
        navigate("/profile");
      }
    };
    checkIfBanned();
  }, [navigate]);
  // 2. Handle Upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioFile || !title) return;
    setUploading(true);
    setUploadError("");
    try {
      if (!userId) throw new Error("User not authenticated");
      // IP Check
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      const userIp = ipData.ip;
      // Limit Check (Secure RPC)
      const { data: limitData, error: limitError } = await supabase.rpc(
        "check_upload_limits",
        {
          p_user_id: userId, // <-- FIX: Corrected argument name
          p_ip_address: userIp, // <-- FIX: Corrected argument name
        },
      );
      if (limitError) throw limitError;
      // --- FIX: Safely access data from RPC response array ---
      const currentUploadCount = parseInt(limitData[0]?.count || 0);
      const isSubscribedFromDB = limitData[0]?.is_subscribed || false;
      const FREE_LIMIT = 3;
      const PAID_LIMIT = 10;
      // Limit set karein
      const userLimit = isSubscribedFromDB ? PAID_LIMIT : FREE_LIMIT;
      // 🚨 FINAL LIMIT ENFORCEMENT 🚨
      if (currentUploadCount >= userLimit) {
        setUploadError(
          `UPLOAD FAILED: Limit reached. You have uploaded ${currentUploadCount} of ${userLimit} items. Please upgrade.`,
        );
        setUploading(false);
        return; // 🛑 UPLOAD ROKO
      }
      // Upload Files
      const fileExt = audioFile.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      await supabase.storage
        .from("content")
        .upload(`media/${fileName}`, audioFile);
      let coverName = null;
      if (coverFile) {
        const coverExt = coverFile.name.split(".").pop();
        coverName = `${crypto.randomUUID()}.${coverExt}`;
        await supabase.storage
          .from("thumbnails")
          .upload(`audio_thumbnail/${coverName}`, coverFile);
      }
      // Save to DB
      await supabase.from("content_uploads").insert({
        title,
        type: "audio",
        price: parseFloat(price),
        file_path: `media/${fileName}`,
        cover_path: coverName ? `audio_thumbnail/${coverName}` : null,
        uploaded_by: userId,
        uploader_ip: userIp,
        status: "pending",
      });
      alert("Uploaded! Waiting for approval.");
      setShowUploadModal(false);
      setTitle("");
      setPrice("2.99");
      setAudioFile(null);
      setCoverFile(null);
    } catch (err) {
      console.error("Upload Error:", err);
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };
  // 3. Handle Stripe Payment
  const handleConfirmPurchase = async () => {
    if (!selectedTrack || !userId) {
      alert("Please login before purchase.");
      return;
    }
    if (!selectedTrack.artist_id) {
      alert("Artist is not connected to Stripe. Cannot buy this track.");
      return;
    }

    setUploading(true);

    try {
      const originUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke(
        "stripe-checkout",
        {
          body: {
            track_id: selectedTrack.id,
            track_price: selectedTrack.price,
            artist_id: selectedTrack.artist_id,
            userId,
            success_url: `${originUrl}/music?purchase=success`,
            cancel_url: `${originUrl}/music?purchase=cancelled`,
          },
        },
      );

      if (error) throw error;

      const sessionData = typeof data === "string" ? JSON.parse(data) : data;
      if (sessionData?.url) {
        window.location.href = sessionData.url;
      } else {
        alert("Payment session creation failed.");
      }
    } catch (err) {
      console.error("Payment Error:", err);
      alert("Payment failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      setShowPurchaseModal(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!user) {
      alert("Please login first");
      return;
    }
    try {
      const originUrl = window.location.origin;
      console.log("Calling create-connect-account with:", {
        userId: user.id,
        origin: originUrl,
      });
      const { data, error } = await supabase.functions.invoke(
        "create-connect-account",
        {
          body: {
            userId: user.id,
            origin: originUrl,
          },
        },
      );
      console.log("Function response:", data);
      console.log("Function error:", error);
      if (error) {
        console.error("Stripe Connect Error:", error);
        alert(
          "Failed to connect: " +
            (error.message || "Check console for details"),
        );
        return;
      }
      if (data?.url) {
        console.log("Redirecting to:", data.url);
        window.location.href = data.url;
      } else {
        alert(
          "No redirect URL received from Stripe. Check console and Stripe dashboard.",
        );
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Something went wrong: " + (err.message || "Check console"));
    }
  };
  const handlePlay = (track) => setCurrentTrack(track);
  const handlePurchase = (track) => {
    setSelectedTrack(track);
    setShowPurchaseModal(true);
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
  return (
    <div className="music-page">
      <div className="music-header">
        <div>
          <h1 className="music-title">Music Marketplace</h1>
          <p className="music-subtitle">Discover exclusive tracks</p>
        </div>
        <div className="header-actions">
          <div className="search-wrapper">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search music..."
              className="search-music"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!stripeConnected && (
            <p className="text-red-400 text-sm mt-2">
              Please connect Stripe account before uploading
            </p>
          )}
          {!stripeConnected ? (
            <button
              type="button"
              className="modal-btn submit"
              onClick={handleConnectStripe}
            >
              Connect Stripe
            </button>
          ) : (
            <button type="button" className="modal-btn submit" disabled>
              Stripe Connected
            </button>
          )}

          {!isBanned && (
            <button
              className="upload-music-btn"
              onClick={() => setShowUploadModal(true)}
            >
              <Upload size={18} /> Upload Track
            </button>
          )}
        </div>
      </div>
      <div className="music-grid">
        {tracks
          .filter(
            (track) =>
              track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              track.artist.toLowerCase().includes(searchQuery.toLowerCase()),
          )
          .map((track) => (
            <MusicCard
              key={track.id}
              track={track}
              onPlay={handlePlay}
              onPurchase={handlePurchase}
            />
          ))}
      </div>
      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowUploadModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowUploadModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="modal-title">Upload Audio</h2>
            {uploadError && (
              <p className="text-red-500 font-bold mb-4">{uploadError}</p>
            )}
            <div className="mb-6">
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-200 font-semibold mb-2">
                  Connect Stripe Account for Payouts
                </p>
                <p className="text-sm text-gray-300 mb-3">
                  To receive earnings from your music sales, connect your Stripe
                  account.
                </p>
                <button
                  onClick={handleConnectStripe}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  Connect Stripe Account
                </button>
              </div>
            </div>
            <form onSubmit={handleUpload}>
              <div className="upload-section">
                <div className="upload-box">
                  <p className="upload-title">Audio File</p>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files[0])}
                    required
                  />
                </div>
                <div className="upload-box">
                  <p className="upload-title">Cover Art</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverFile(e.target.files[0])}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Price</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
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
                  disabled={uploading || (!isSubscribed && uploadCount >= 3)}
                >
                  {uploading ? "Uploading..." : "Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PURCHASE MODAL */}
      {showPurchaseModal && selectedTrack && (
        <div
          className="modal-overlay"
          onClick={() => setShowPurchaseModal(false)}
        >
          <div
            className="modal-content purchase-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="purchase-header">
              <img
                src={selectedTrack.albumArt}
                alt={selectedTrack.title}
                className="purchase-art"
              />
              <div>
                <h2 className="modal-title">{selectedTrack.title}</h2>
                <p className="purchase-artist">{selectedTrack.artist}</p>
              </div>
            </div>
            <div className="purchase-details">
              <div className="detail-row">
                <span>Price</span>
                <span className="detail-value">${selectedTrack.price}</span>
              </div>
              <div className="detail-row">
                <span>Artist Share</span>
                <span className="detail-value">80%</span>
              </div>
              <div className="detail-row">
                <span>Platform Fee</span>
                <span className="detail-value">20%</span>
              </div>
              <div className="detail-row total">
                <span>Total</span>
                <span className="detail-value">${selectedTrack.price}</span>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancel
              </button>
              <button
                className="modal-btn submit"
                onClick={handleConfirmPurchase}
                disabled={uploading}
              >
                {uploading ? "Processing..." : `Pay $${selectedTrack.price}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {currentTrack && (
        <MusicPlayer
          currentTrack={currentTrack}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={() => setCurrentTrack(null)} // <--- important
        />
      )}
    </div>
  );
};
export default Music;
