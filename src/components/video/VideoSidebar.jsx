import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  Home,
  TrendingUp,
  Radio,
  Clock,
  ThumbsUp,
  Bookmark,
} from "lucide-react";
import "./VideoSidebar.css";

const getAvatarUrl = (url, name) => {
  if (url && typeof url === "string" && url.length > 5) return url;
  const safeName = name ? name.replace(/\s+/g, "+") : "User";
  return `https://ui-avatars.com/api/?name=${safeName}&background=0D8ABC&color=fff&size=128&bold=true`;
};

const VideoSidebar = ({
  activeCategory,
  onCategoryChange,
  collapsed: parentCollapsed,
  onCollapse,
  mobileOpen,
  setMobileOpen,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [watchLaterCount, setWatchLaterCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
    if (onCollapse) onCollapse(!collapsed);
  };

  useEffect(() => {
    const fetchData = async (user) => {
      setLoading(true);
      const userId = user
        ? user.id
        : (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setCurrentUser(null);
        setSubscriptions([]);
        setLoading(false);
        return;
      }
      setCurrentUser({ id: userId });

      // History
      const { count } = await supabase
        .from("video_views")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setHistoryCount(count || 0);

      // Watch Later
      const { count: wlCnt } = await supabase
        .from("watch_later")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setWatchLaterCount(wlCnt || 0);

      // Liked
      const { count: likeCnt } = await supabase
        .from("video_likes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_like", true);
      setLikedCount(likeCnt || 0);

      // Subscriptions
      const { data: subs, error: subError } = await supabase
        .from("channel_subscriptions")
        .select(
          `
 channel_id,
 profiles!channel_subscriptions_channel_id_fkey (full_name, avatar_url)
 `,

        )
        .eq("user_id", userId);

      if (!subError && subs) {
        const formattedSubs = subs.map((sub) => {
          const profile = sub.profiles;
          const name = profile?.full_name || "Channel";
          return {
            id: sub.channel_id,
            name: name,
            avatarUrl: getAvatarUrl(profile?.avatar_url, name),
          };
        });
        setSubscriptions(formattedSubs);
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) fetchData(session.user);
        else {
          setCurrentUser(null);
          setSubscriptions([]);
        }
      },

    );

    fetchData(null);

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const categories = [
    { id: "all", icon: Home, label: "Home" },
    { id: "trending", icon: TrendingUp, label: "Most Watched" },
    { id: "live", icon: Radio, label: "Live" },
    { id: "history", icon: Clock, label: `History (${historyCount})` },
    {
      id: "watchlater",
      icon: Bookmark,
      label: `Watch Later (${watchLaterCount})`,
    },
    { id: "liked", icon: ThumbsUp, label: `Liked Videos (${likedCount})` },
  ];

  return (
    <aside
      className={`video-sidebar ${collapsed || parentCollapsed ? "collapsed" : ""}`}
    >
      <button className="collapse-btn" onClick={toggleSidebar}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="white"
          style={{ pointerEvents: "none", display: "block", margin: "0 auto" }}
        >
          <path d="M20 5H4a1 1 0 000 2h16a1 1 0 100-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Zm0 6H4a1 1 0 000 2h16a1 1 0 000-2Z"></path>
        </svg>
      </button>

      <div className="sidebar-content">
        {categories.map((category) => (
          <button
            key={category.id}
            className={`sidebar-item ${activeCategory === category.id ? "active" : ""}`}
            onClick={() => onCategoryChange(category.id)}
          >
            <category.icon size={22} />
            {!collapsed && <span>{category.label}</span>}
          </button>
        ))}

        <hr />

        {currentUser && (
          <>
            <div className="section-title">
              {!collapsed && <span>Subscriptions</span>}
            </div>


            {loading ? (
              <p className="loading-text">{!collapsed && "Loading..."}</p>
            ) : subscriptions.length > 0 ? (
              subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  className="sidebar-item subscription-item"
                  onClick={() =>
                    onCategoryChange(`channel_${sub.id}_${sub.name.replace(/\s+/g, "~")}`)
                  }
                >

                  <img
                    src={sub.avatarUrl}
                    alt={sub.name}
                    className="subscription-avatar"
                  />
                  {!collapsed && <span>{sub.name}</span>}
                </button>
              ))
            ) : (
              <p className="empty-text">{!collapsed && "No subscriptions yet"}</p>
            )}
            <hr />
          </>
        )}
      </div>
    </aside>
  );
};

export default VideoSidebar;
