import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Video,
  Music,
  Calendar,
  Menu,
  X,
  Search,
  Bell,
  Zap,
  LogOut,
  Clock,
} from "lucide-react";
import "./Navigation.css";
import { supabase } from "../lib/supabase";
// ---- Helper: Avatar Generator ----
const getAvatarUrl = (url, name) => {
  if (url && typeof url === "string" && url.length > 5) return url;
  const safeName = name ? name.replace(/\s+/g, "+") : "User";
  return `https://ui-avatars.com/api/?name=${safeName}&background=0D8ABC&color=fff&size=128&bold=true`;
};

// ---- Helper: Relative Time Formatter ----
const formatRelativeTime = (dateString) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return past.toLocaleDateString();
};
const Navigation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState({ name: "Guest", email: "", id: null });
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  // Example check for your Notifications component:
  useEffect(() => {
    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          console.log("Nayi Notification Aayi!", payload.new);
          // Yahan state update karein taake laal dot nazar aaye
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Navigation.jsx ke useEffect ke andar:
  useEffect(() => {
    if (!user?.id) return; // Wait for user ID to load

    const channelName = `notifs-${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`, // ✅ Sirf receiver (subscriber) ko signal milega
        },
        async (payload) => {
          console.log("Nayi notification receiver tak pahunch gayi!");
          await fetchNotifications(); // Refresh list for subscriber
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]); // ✅ Dependency array mein user.id lazmi rakhein

  // --- Notification Logic (Merged & Robust) ---
  useEffect(() => {
    if (!user.id) return;

    // 1. Function to fetch all notifications and update count
    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select(
            `
              *,
              actor:profiles (full_name, avatar_url)
            `,
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(15);

        if (error) throw error;

        const formatted = data.map((n) => ({
          ...n,
          actorName: n.actor?.full_name || "User",
          actorAvatar: n.actor?.avatar_url,
        }));

        setNotifications(formatted);
        // Sirf unread wali filter karke count set karein
        const unread = formatted.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      } catch (err) {
        console.error("Fetch Error:", err.message);
      }
    };

    // Initial fetch
    fetchNotifications();

    // 2. Real-time Listener
    const channel = supabase
      .channel(`user-notifs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("New Notification Received!", payload.new);
          await fetchNotifications();
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Realtime error! Check Supabase Replication settings.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);
  // --- Notification Logic End ---

  const markAsRead = async () => {
    if (unreadCount === 0) return;
    setUnreadCount(0);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };
  // --- Notification Logic End ---

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, avatar_url")
          .eq("id", session.user.id)
          .single();

        const userName =
          profile?.full_name || session.user.email?.split("@")[0] || "User";
        setUser({
          id: session.user.id,
          name: userName,
          email: session.user.email || "",
          avatar_url: profile?.avatar_url || null,
        });
        setIsAdmin(
          profile?.role === "admin" ||
            session.user.email === "admin@example.com"
        );
      } else {
        setUser({ name: "Guest", email: "", id: null });
        setIsAdmin(false);
      }
    };

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          checkUser();
        } else if (event === "SIGNED_OUT") {
          setUser({ name: "Guest", email: "", id: null });
          setIsAdmin(false);
        }
      }
    );

    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/videos", icon: Video, label: "Videos" },
    { path: "/music", icon: Music, label: "Music" },
    { path: "/events", icon: Calendar, label: "Events" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <div className="logo-icon">
            {/* <img src="/assets/logo.jpeg" alt="logo" className="logo-image" /> */}
          </div>
          <span className="logo-text">StreamHub</span>
        </Link>

        <form className="nav-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search videos, music, events..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <Search size={20} />
          </button>
        </form>

        <div className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive(item.path) ? "active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="nav-actions">
          <Link to="/subscription" className="upgrade-btn">
            <Zap size={18} fill="currentColor" />
            <span>Upgrade</span>
          </Link>

          {/* 🔔 Notification Container */}
          <div className="notification-container" ref={notifRef}>
            <button
              className="nav-action-btn"
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) markAsRead();
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notif-dropdown">
                <div className="notif-header">Notifications</div>
                <div className="notif-list">
                  {notifications.length > 0 ? (
                    notifications.map((n) => {
                      // Actor ka poora naam aur sahi avatar URL
                      const displayName = n.actorName;
                      const avatarToDisplay = getAvatarUrl(
                        n.actorAvatar,
                        displayName,
                      );

                      /* ⬇️ Yahan RETURN likhna zaroori hai ⬇️ */
                      return (
                        <div
                          key={n.id}
                          className={`notif-item ${!n.is_read ? "unread" : ""}`}
                          onClick={() =>
                            navigate(n.video_id ? `/video/${n.video_id}` : "#")
                          }
                        >
                          <img
                            src={avatarToDisplay}
                            alt={displayName}
                            style={{
                              width: "35px",
                              height: "35px",
                              borderRadius: "50%",
                              marginRight: "10px",
                              objectFit: "cover",
                            }}
                          />

                          <div className="notif-content">
                            <p className="notif-msg">
                              <strong style={{ color: "white" }}>
                                {displayName}
                              </strong>{" "}
                              {n.message}
                            </p>
                            <span
                              className="notif-time"
                              style={{
                                fontSize: "10px",
                                color: "#888",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Clock size={10} style={{ marginRight: "4px" }} />
                              {formatRelativeTime(n.created_at)}
                            </span>
                          </div>
                        </div>
                      ); /* ⬆️ Return yahan khatam ho raha hai ⬆️ */
                    })
                  ) : (
                    <div
                      className="notif-empty"
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "#888",
                      }}
                    >
                      No new notifications
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="nav-actions">
            {/* <Link to="/subscription" className="upgrade-btn">
              <Zap size={12} fill="currentColor" />
              <span>Upgrade</span>
            </Link> */}

          
            <div className="user-menu-wrapper" ref={userMenuRef}>
              <button
                className="profile-circle-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="User"
                    className="profile-avatar-img"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info-block">
                    <div className="user-info-avatar">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="User"
                          className="dropdown-avatar-img"
                        />
                      ) : (
                        user?.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="user-info-name">{user?.name}</p>
                      <p className="user-info-email">{user?.email}</p>
                      <Link
                        to="/profile"
                        className="view-profile-link"
                        onClick={() => setShowUserMenu(false)}
                      >
                        View your channel
                      </Link>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Zap size={16} /> <span>Admin Panel</span>
                    </Link>
                  )}
                  {user.email && (
                    <button
                      className="dropdown-item logout-btn"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} /> <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button on right */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="mobile-menu-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon size={20} /> <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navigation;
