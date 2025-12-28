import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./UserProfile.css";
import { FaUpload } from "react-icons/fa";
import { supabase } from "../lib/supabase";

// Import components from the correct path (Adjust if they are in 'pages')
import { UserProfileHome } from "./UserProfileHome";
import { UserProfileAbout } from "./UserProfileAbout";
import { UserProfileVideos } from "./UserProfileVideos";
import { UserProfileMusic } from "./UserProfileMusic";

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1) FETCH AUTH USER
  useEffect(() => {
    const loadUser = async () => {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.user.id)
        .single();

      setUser(profile);
      fetchSubscriberCount(profile.id);
      setLoading(false);

      supabase
        .channel("profile-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${profile.id}`,
          },
          (payload) => {
            setUser((prev) => ({ ...prev, ...payload.new }));
          },
        )
        .subscribe();
    };
    loadUser();
  }, []);

  const fetchSubscriberCount = async (channelId) => {
    const { data, error } = await supabase.rpc("get_channel_subscriber_count", {
      p_channel_id: channelId,
    });
    if (!error) setSubscriberCount(data || 0);
  };

  const uploadToBucket = async (bucket, file) => {
    const filePath = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });
    if (error) return null;
    const { data: url } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return url.publicUrl;
  };

  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const publicUrl = await uploadToBucket("profile-pictures", file);
    if (!publicUrl) return;
    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    setUser((prev) => ({ ...prev, avatar_url: publicUrl }));
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    const publicUrl = await uploadToBucket("banner-pictures", file);
    if (!publicUrl) return;
    await supabase
      .from("profiles")
      .update({ banner_url: publicUrl })
      .eq("id", user.id);
    setUser((prev) => ({ ...prev, banner_url: publicUrl }));
  };

  if (loading)
    return (
      <div className="text-white text-center py-20">Loading Profile...</div>
    );

  return (
    <div className="channel-page">
      {/* Banner */}
      <div className="banner-section">
        {user.banner_url ? (
          <img src={user.banner_url} alt="Banner" className="banner-img" />
        ) : (
          <div className="banner-empty">Upload Channel Banner</div>
        )}
        <label className="banner-upload-btn">
          Upload Banner{" "}
          <input type="file" hidden onChange={handleBannerUpload} />
        </label>
      </div>

      {/* Profile */}
      <div className="profile-section">
        <div className="profile-img-wrapper">
          {user.avatar_url ? (
            <img src={user.avatar_url} className="profile-img" alt="Profile" />
          ) : (
            <div className="profile-placeholder">
              {user.full_name?.charAt(0).toUpperCase()}
            </div>
          )}
          <label className="profile-upload-btn">
            Insert Image{" "}
            <input type="file" hidden onChange={handleProfileUpload} />
          </label>
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{user.full_name}</h2>
          <p className="profile-subs">{subscriberCount} subscribers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="channel-tabs">
        {["home", "videos", "music", "about"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="channel-content">
        {activeTab === "home" && <UserProfileHome userId={user.id} />}

        {activeTab === "videos" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "20px",
              }}
            >
              <button
                className="btn-upload-video"
                onClick={() => navigate("/videos")}
                style={{
                  background: "#3ea6ff",
                  color: "black",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "bold",
                }}
              >
                <FaUpload /> Upload New Video
              </button>
            </div>
            {/* The Real Component */}
            <UserProfileVideos userId={user.id} />
          </div>
        )}

        {activeTab === "music" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "20px",
              }}
            >
              <button
                className="btn-upload-music"
                onClick={() => navigate("/music")}
                style={{
                  background: "#3ea6ff",
                  color: "black",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "bold",
                }}
              >
                <FaUpload /> Upload New Track
              </button>
            </div>
            {/* The Real Component */}
            <UserProfileMusic userId={user.id} />
          </div>
        )}

        {activeTab === "about" && <UserProfileAbout user={user} />}
      </div>
    </div>
  );
};

export default UserProfile;
