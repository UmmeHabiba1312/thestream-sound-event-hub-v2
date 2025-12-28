// src/pages/AdminPanel.jsx → Unified Audio + Video Approvals
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Video,
  Settings,
  LogOut,
  Search,
  Ban,
  RotateCcw,
  CheckCircle,
  Upload,
  AlertTriangle,
  IndianRupee,
  UserCheck,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import "./AdminPanel.css";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingEvents, setPendingEvents] = useState([]);
  const navigate = useNavigate();

  // ---------- Fetchers ----------
  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          full_name,
          role,
          banned,
          subscription_plan,
          uploads_count,
          created_at
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((u) => ({
        id: u.id,
        name: u.full_name || "User",
        email: "—", // email auth.users mein hota hai
        role: u.role || "user",
        uploads: u.uploads_count ?? 0,
        status: u.banned ? "Banned" : "Active",
        subscription: u.subscription_plan || "free",
        created_at: u.created_at,
      }));

      setUsers(formatted);
    } catch (err) {
      console.error("fetchUsers error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingUploads = async () => {
    try {
      const { data: audioData } = await supabase
        .from("content_uploads")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .eq("approved", false)
        .order("created_at", { ascending: false });

      const merged = [
        ...(audioData || []).map((a) => ({ ...a, type: "audio" })),
        ...(videoData || []).map((v) => ({ ...v, type: "video" })),
      ];

      setPendingUploads(merged);
    } catch (err) {
      console.error("fetchPendingUploads error", err);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const { data: payments } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const paymentsArr = payments || [];
      if (!paymentsArr.length) return setPendingPayments([]);

      const userIds = paymentsArr.map((p) => p.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, subscription_plan")
        .in("id", userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const enriched = paymentsArr.map((p) => ({
        ...p,
        user_profile: profileMap[p.user_id] || null,
        user_email: profileMap[p.user_id]?.full_name
          ? profileMap[p.user_id].full_name
          : null,
      }));

      setPendingPayments(enriched);
    } catch (err) {
      console.error("fetchPendingPayments error", err);
    }
  };

  const fetchPendingEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "pending")
        .order("event_datetime", { ascending: false });

      if (error) throw error;
      setPendingEvents(data || []);
    } catch (err) {
      console.error("fetchPendingEvents error", err);
    }
  };

  // ---------- Effects ----------
  useEffect(() => {
    if (activeTab === "users") fetchUsers();
    if (activeTab === "uploads") fetchPendingUploads();
    if (activeTab === "payments") fetchPendingPayments();
    if (activeTab === "events") fetchPendingEvents();
  }, [activeTab]);

  // ---------- Actions ----------
  const toggleUserStatus = async (userId) => {
    try {
      const u = users.find((x) => x.id === userId);
      if (!u) return;

      // if (u.status === "Banned") {
      //   const { error } = await supabase.auth.admin.updateUserById(userId, {
      //     banned_until: null,
      //   });
      //   if (error) throw error;
      // } else {
      //   const banDate = new Date();
      //   banDate.setFullYear(banDate.getFullYear() + 10);
      //   const { error } = await supabase.auth.admin.updateUserById(userId, {
      //     banned_until: banDate.toISOString(),
      //   });
      //   if (error) throw error;
      // }

      await fetchUsers();
    } catch (err) {
      console.error("toggleUserStatus error", err);
      alert("Failed to change user status.");
    }
  };

  const resetUploads = async (userId) => {
    try {
      await supabase
        .from("upload_limits")
        .delete()
        .ilike("ip_address", `%${userId.slice(0, 8)}%`);
      await fetchUsers();
    } catch (err) {
      console.error("resetUploads error", err);
      alert("Failed to reset uploads.");
    }
  };

  const approveUpload = async (item) => {
    try {
      const table = item.type === "audio" ? "content_uploads" : "videos";
      const updatePayload =
        item.type === "audio" ? { status: "approved" } : { approved: true };

      const { data, error } = await supabase
        .from(table)
        .update(updatePayload)
        .eq("id", item.id)
        .select();

      if (error) throw error;

      console.log("Approved:", data);

      // ✅ Remove from UI immediately
      setPendingUploads((prev) => prev.filter((u) => u.id !== item.id));
    } catch (err) {
      console.error("Approve Upload Error:", err);
      alert("Failed to approve upload.");
    }
  };

  const approveEvent = async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .update({ status: "approved" })
        .eq("id", eventId)
        .select();

      if (error) throw error;
      // ✅ UI se foran remove
      setPendingEvents((prev) => prev.filter((event) => event.id !== eventId));

      console.log("Event approved DB:", data);
    } catch (err) {
      console.error("Approve error:", err);
      alert("Approve failed");
    }
  };
  const rejectEvent = async (eventId) => {
    try {
      await supabase
        .from("events")
        .update({ status: "rejected" })
        .eq("id", eventId);

      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
      alert("Event rejected!");
    } catch (err) {
      console.error(err);
      alert("Reject failed");
    }
  };

  const verifyPayment = async (paymentId, ip) => {
    try {
      const { error: e1 } = await supabase
        .from("subscription_payments")
        .update({ status: "verified" })
        .eq("id", paymentId);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("upload_limits")
        .upsert(
          { ip_address: ip, has_subscription: true },
          { onConflict: "ip_address" },
        );
      if (e2) throw e2;

      await fetchPendingPayments();
      alert("10 Uploads Unlocked!");
    } catch (err) {
      console.error("verifyPayment error", err);
      alert("Failed to verify payment.");
    }
  };

  // ---------- Derived / filtered data ----------
  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "Active").length,
    totalUploads: users.reduce(
      (sum, u) => sum + (typeof u.uploads === "number" ? u.uploads : 0),
      0,
    ),
    bannedUsers: users.filter((u) => u.status === "Banned").length,
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ---------- Render ----------
  return (
    <div className="admin-panel">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <Video className="logo-icon" />
          <span>Admin Panel</span>
        </div>
        <nav className="admin-nav">
          <button
            className={`admin-nav-item ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <LayoutDashboard size={20} /> <span>Dashboard</span>
          </button>
          <button
            className={`admin-nav-item ${activeTab === "uploads" ? "active" : ""}`}
            onClick={() => setActiveTab("uploads")}
          >
            <Upload size={20} />{" "}
            <span>Pending Uploads ({pendingUploads.length})</span>
          </button>
          <button
            className={`admin-nav-item ${activeTab === "events" ? "active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            <Video size={20} />{" "}
            <span>Pending Events ({pendingEvents.length})</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            <IndianRupee size={20} />{" "}
            <span>Payments ({pendingPayments.length})</span>
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-title">
            {activeTab === "users" && "User Management"}
            {activeTab === "uploads" && "Pending Content Approval"}
            {activeTab === "payments" && "Payment Verification"}
            {activeTab === "events" && "Pending Events Approval"}
          </h1>
          <div className="admin-actions">
            <button className="admin-logout-btn" onClick={handleLogout}>
              <LogOut size={20} /> <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="admin-content">
          {/* USERS TAB */}
          {activeTab === "users" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div
                    className="stat-icon"
                    style={{
                      background:
                        "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
                    }}
                  >
                    <Users size={24} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Total Users</p>
                    <h3 className="stat-value">{stats.totalUsers}</h3>
                  </div>
                </div>
                <div className="stat-card">
                  <div
                    className="stat-icon"
                    style={{
                      background:
                        "linear-gradient(135deg,#f093fb 0%,#f5576c 100%)",
                    }}
                  >
                    <UserCheck size={24} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Active Users</p>
                    <h3 className="stat-value">{stats.activeUsers}</h3>
                  </div>
                </div>
                <div className="stat-card">
                  <div
                    className="stat-icon"
                    style={{
                      background:
                        "linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)",
                    }}
                  >
                    <Upload size={24} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Total Uploads</p>
                    <h3 className="stat-value">{stats.totalUploads}</h3>
                  </div>
                </div>
                <div className="stat-card">
                  <div
                    className="stat-icon"
                    style={{
                      background:
                        "linear-gradient(135deg,#fa709a 0%,#fee140 100%)",
                    }}
                  >
                    <AlertTriangle size={24} />
                  </div>
                  <div className="stat-info">
                    <p className="stat-label">Banned Users</p>
                    <h3 className="stat-value">{stats.bannedUsers}</h3>
                  </div>
                </div>
              </div>

              <div className="admin-search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Uploads</th>
                      <th>Status</th>
                      <th>Join Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <div className="user-avatar">
                              {user.name.charAt(0)}
                            </div>
                            <span>{user.name}</span>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className="role-badge">{user.role}</span>
                        </td>
                        <td>
                          <span className="upload-count">{user.uploads}</span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${user.status.toLowerCase()}`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className={`action-btn ${user.status === "Banned" ? "unban" : "ban"}`}
                              onClick={() => toggleUserStatus(user.id)}
                            >
                              {user.status === "Banned" ? (
                                <CheckCircle size={16} />
                              ) : (
                                <Ban size={16} />
                              )}
                            </button>
                            <button
                              className="action-btn reset"
                              onClick={() => resetUploads(user.id)}
                            >
                              <RotateCcw size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PENDING UPLOADS TAB */}
          {activeTab === "uploads" &&
            pendingUploads.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800 rounded-xl p-6 mb-4 flex justify-between items-center"
              >
                <div className="flex items-center gap-6">
                  {item.type === "audio" && item.cover_path && (
                    <img
                      src={
                        supabase.storage
                          .from("content")
                          .getPublicUrl(item.cover_path).data.publicUrl
                      }
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  {item.type === "video" && item.thumbnail_url && (
                    <img
                      src={
                        supabase.storage
                          .from("thumbnails")
                          .getPublicUrl(item.thumbnail_url).data.publicUrl
                      }
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-gray-400">
                      {item.type === "audio" ? `Price: $${item.price}` : ""}
                      {item.type === "video"
                        ? `Category: ${item.category}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => approveUpload(item)}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-bold flex items-center gap-2"
                  >
                    <CheckCircle size={20} /> APPROVE
                  </button>
                  <button className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-lg font-bold">
                    REJECT
                  </button>
                </div>
              </div>
            ))}

          {/* PENDING EVENTS TAB */}
          {activeTab === "events" &&
            pendingEvents.map((event) => (
              <div
                key={event.id}
                className="bg-gray-800 rounded-xl p-6 mb-4 flex justify-between items-center"
              >
                <div className="flex items-center gap-6">
                  {event.poster_url && (
                    <img
                      src={event.poster_url}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{event.title}</h3>
                    <p className="text-gray-400">
                      {new Date(event.event_datetime).toLocaleDateString()} at{" "}
                      {new Date(event.event_datetime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-gray-400">Venue: {event.venue}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => approveEvent(event.id)}
                    className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-bold flex items-center gap-2"
                  >
                    <CheckCircle size={20} /> APPROVE
                  </button>

                  <button
                    onClick={() => rejectEvent(event.id)}
                    className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-lg font-bold"
                  >
                    REJECT
                  </button>
                </div>
              </div>
            ))}

          {/* PAYMENT VERIFICATION TAB */}
          {activeTab === "payments" &&
            pendingPayments.map((payment) => (
              <div key={payment.id} className="bg-gray-800 rounded-xl p-6 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold">
                      ₹{payment.amount} Payment -{" "}
                      {payment.user_profile?.full_name ||
                        payment.user_email ||
                        "Unknown"}
                    </p>
                    <p className="text-gray-400">
                      TXN ID: {payment.transaction_id}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      verifyPayment(payment.id, payment.ip_address)
                    }
                    className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg"
                  >
                    Verify & Unlock 10 Uploads
                  </button>
                </div>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
