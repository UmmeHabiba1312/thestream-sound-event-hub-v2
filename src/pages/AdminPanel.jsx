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
  AlertTriangle,
  CheckCircle,
  Upload,
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
  const [refundRequests, setRefundRequests] = useState([]);
  const navigate = useNavigate();

  const fetchRefundRequests = async () => {
    try {
      setLoading(true);

      const { data: requests, error } = await supabase
        .from("refund_requests")
        .select("id, ticket_id, user_id, reason, amount, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      console.log("RAW REFUND REQUESTS FROM DB:", requests); // ← YE ADD KAR DO
      console.log("ERROR IF ANY:", error);

      if (error) throw error;
      if (!requests || requests.length === 0) {
        setRefundRequests([]);
        console.log("No requests found - empty array");
        return;
      }

      // Step 2: Tickets fetch (with events nested)
      const ticketIds = requests.map((r) => r.ticket_id);
      const { data: ticketsData } = await supabase
        .from("tickets")
        .select(
          `
          id,
          qr_code,
          original_price,
          resale_price,
          events (
            title,
            venue,
            event_datetime
          )
        `,
        )
        .in("id", ticketIds);

      const ticketMap = {};
      ticketsData?.forEach((t) => {
        ticketMap[t.id] = t;
      });

      // Step 3: Users fetch
      const userIds = requests.map((r) => r.user_id).filter(Boolean);
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || "Unknown User";
          return acc;
        }, {});
      }

      // Step 4: Enriched data
      const enriched = requests.map((r) => ({
        ...r,
        user_name: profileMap[r.user_id] || "Unknown User",
        event_title: ticketMap[r.ticket_id]?.events?.title || "Unknown Event",
        venue: ticketMap[r.ticket_id]?.events?.venue || "Unknown",
        qr_code: ticketMap[r.ticket_id]?.qr_code || "N/A",
        original_price: ticketMap[r.ticket_id]?.original_price || 0,
        resale_price: ticketMap[r.ticket_id]?.resale_price || 0,
      }));

      setRefundRequests(enriched);
      console.log("Enriched refund requests:", enriched);
    } catch (err) {
      console.error("fetchRefundRequests error:", err);
      alert("Failed to load refund requests");
    } finally {
      setLoading(false);
    }
  };

  const sendWarning = async (userId, userName) => {
    const reason = prompt(`Warning reason for ${userName || "this user"}:`);

    if (!reason || reason.trim() === "") return;

    if (!confirm(`Send warning?\nReason: ${reason.trim()}`)) return;

    try {
      const { data: currentProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("warning_count, warning_reasons")
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;

      const newCount = (currentProfile.warning_count || 0) + 1;
      const newReasons = [
        ...(currentProfile.warning_reasons || []),
        reason.trim(),
      ];

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          warning_count: newCount,
          last_warning_at: new Date().toISOString(),
          warning_reasons: newReasons,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Notification bhejo
      await supabase.from("notifications").insert({
        user_id: userId,
        message: `Warning #${newCount}: ${reason.trim()}. Avoid repeated violations.`,
        type: "warning",
      });

      // Agar 3 warnings → auto ban
      if (newCount >= 3) {
        await supabase
          .from("profiles")
          .update({
            banned: true,
            ban_reason: "3 warnings received - repeated violations",
          })
          .eq("id", userId);

        await supabase.from("notifications").insert({
          user_id: userId,
          message:
            "Your account has been permanently banned due to repeated violations.",
          type: "ban",
        });

        alert(
          `Warning sent! User reached ${newCount} warnings → Automatically BANNED!`,
        );
      } else {
        alert(`Warning sent! Total warnings: ${newCount}`);
      }

      fetchUsers(); // Refresh users list
    } catch (err) {
      console.error("Send warning error:", err);
      alert("Failed: " + err.message);
    }
  };

  const approveRefund = async (requestId, ticketId, req) => {
    if (!confirm(`Approve refund of $${req.amount} for ticket ${ticketId}?`))
      return;

    try {
      let refundSuccess = false;
      let message = "";

      // 1. Auto refund try
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("payment_intent_id")
        .eq("id", ticketId)
        .single();

      if (!ticketError && ticket?.payment_intent_id) {
        const { error: refundError } = await supabase.functions.invoke(
          "stripe-refund",
          {
            body: {
              payment_intent: ticket.payment_intent_id,
              amount: Math.round(req.amount * 100),
            },
          },
        );

        if (!refundError) {
          refundSuccess = true;
          message = "Money returned automatically!";
        } else {
          message = "Auto refund failed – manual refund in Stripe";
        }
      } else {
        message =
          "Payment Intent not found – manual refund in Stripe dashboard";
      }

      // 2. DB update (status approved)
      const { error: reqError } = await supabase
        .from("refund_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(), // agar column add kiya to
        })
        .eq("id", requestId);

      if (reqError) throw reqError;

      // 3. Ticket refunded
      const { error: ticketUpdateError } = await supabase
        .from("tickets")
        .update({ status: "refunded" })
        .eq("id", ticketId);

      if (ticketUpdateError) throw ticketUpdateError;

      // 4. Primary ticket tha to available +1
      if (!req.resale_price || req.resale_price === 0) {
        const { data: eventData } = await supabase
          .from("tickets")
          .select("event_id")
          .eq("id", ticketId)
          .single();

        if (eventData?.event_id) {
          const { data: event } = await supabase
            .from("events")
            .select("available_tickets")
            .eq("id", eventData.event_id)
            .single();

          await supabase
            .from("events")
            .update({ available_tickets: event.available_tickets + 1 })
            .eq("id", eventData.event_id);
        }
      }

      alert(`Refund approved! ${message}`);
      fetchRefundRequests();
    } catch (err) {
      console.error(err);
      alert("Refund process failed: " + (err.message || "Unknown error"));
    }
  };

  const rejectRefund = async (requestId) => {
    if (!confirm("Reject this refund request?")) return;

    try {
      await supabase
        .from("refund_requests")
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      alert("Refund rejected");
      fetchRefundRequests();
    } catch (err) {
      console.error(err);
      alert("Reject failed");
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return navigate("/login");

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (data?.role !== "admin") {
        navigate("/unauthorized");
      }
    };

    checkAdmin();
  }, []);

  // ---------- Fetchers ----------
  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: profilesData, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, uploads_count, banned, subscription_plan, created_at,warning_count",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (profilesData || []).map((u) => ({
        id: u.id,
        name: u.full_name || "User",
        email: u.email || "—", // ← Ab yahan direct email milega
        role: u.role || "user",
        uploads: u.uploads_count ?? 0,
        status: u.banned ? "Banned" : "Active",
        banned: u.banned,
        subscription: u.subscription_plan || "free",
        created_at: u.created_at,
        warningCount: u.warning_count ?? 0,
      }));

      setUsers(formatted);
    } catch (err) {
      console.error("fetchUsers error", err);
      alert("Failed to fetch users.");
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

  useEffect(() => {
    fetchPendingUploads();
    fetchPendingEvents();
    fetchPendingPayments();
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    if (activeTab === "users") fetchUsers();
    if (activeTab === "uploads") fetchPendingUploads();
    if (activeTab === "payments") fetchPendingPayments();
    if (activeTab === "events") fetchPendingEvents();
    if (activeTab === "refunds") fetchRefundRequests();
  }, [activeTab]);

  // ---------- Actions ----------
  const toggleUserStatus = async (userId) => {
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;

      const newBannedStatus = !user.banned;

      const { error } = await supabase
        .from("profiles")
        .update({ banned: newBannedStatus })
        .eq("id", userId);

      if (error) {
        console.error("Supabase update error:", error);
        alert("Failed: " + error.message);
        return;
      }

      // Optimistic UI update (best way – instant change dikhega)
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId
            ? {
                ...u,
                banned: newBannedStatus,
                status: newBannedStatus ? "Banned" : "Active",
              }
            : u,
        ),
      );

      // Optional: alert ya toast
      alert(
        newBannedStatus
          ? "User banned successfully!"
          : "User unbanned successfully!",
      );
    } catch (err) {
      console.error("toggleUserStatus error", err);
      alert("Something went wrong. Check console.");
    }
  };

  const resetUploads = async (userId) => {
    try {
      await supabase
        .from("profiles")
        .update({ remaining_video_uploads: 3, remaining_music_uploads: 3 })
        .eq("id", userId);

      fetchUsers();
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

  const handleApproveRefund = async (request) => {
    if (
      !confirm(
        `Approve refund for ticket ${request.ticket_id}? Amount: $${request.amount}`,
      )
    ) {
      return;
    }

    try {
      // 1. Ticket se payment_intent fetch karo (agar save kiya hai, warna Stripe payment se)
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("payment_intent_id") // ← Ye column hona chahiye tickets table mein
        .eq("id", request.ticket_id)
        .single();

      if (ticketError || !ticket.payment_intent_id) {
        alert("Payment Intent not found – cannot refund");
        return;
      }

      // 2. Supabase function invoke karo jo Stripe refund kare
      const { data: refundData, error: refundError } =
        await supabase.functions.invoke("stripe-refund", {
          body: {
            payment_intent: ticket.payment_intent_id,
            amount: Math.round(request.amount * 100), // cents mein
            refund_request_id: request.id,
          },
        });

      if (refundError) throw refundError;

      // 3. Success pe DB update
      const { error: updateError } = await supabase
        .from("refund_requests")
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          stripe_refund_id: refundData.refund.id,
        })
        .eq("id", request.id);

      if (updateError) throw updateError;

      // 4. Ticket invalidate
      await supabase
        .from("tickets")
        .update({ status: "refunded" })
        .eq("id", request.ticket_id);

      // 5. Agar primary ticket tha → available_tickets +1
      if (!request.purchased_via_resale) {
        // ya ticket.purchased_via_resale false
        await supabase.rpc("increment_available_tickets", {
          event_id_param: request.event_id,
        });
      }

      alert("Refund approved and processed successfully!");
      fetchRefundRequests(); // refresh list
    } catch (err) {
      console.error(err);
      alert("Refund failed: " + (err.message || "Unknown error"));
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

  const verifyPayment = async (payment) => {
    try {
      // Mark payment as verified
      await supabase
        .from("subscription_payments")
        .update({ status: "verified" })
        .eq("id", payment.id);

      // Update user subscription
      await supabase
        .from("profiles")
        .update({
          subscription_plan: "standard",
          subscription_expires_at: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ), // 1 year
          remaining_video_uploads: 10,
          remaining_music_uploads: 10,
        })
        .eq("id", payment.user_id);

      fetchPendingPayments();
      alert("Subscription updated & 10 uploads unlocked!");
    } catch (err) {
      console.error("verifyPayment error", err);
      alert("Failed to verify payment.");
    }
  };

  const rejectUpload = async (item) => {
    try {
      const table = item.type === "audio" ? "content_uploads" : "videos";

      if (item.type === "audio") {
        const { error } = await supabase
          .from(table)
          .update({ status: "rejected" })
          .eq("id", item.id)
          .select();
        if (error) throw error;
      } else {
        // Video ke liye DELETE kar do (rejected content nahi rakhna)
        const { error } = await supabase.from(table).delete().eq("id", item.id);
        if (error) throw error;
      }

      setPendingUploads((prev) => prev.filter((u) => u.id !== item.id));
    } catch (err) {
      console.error("Reject Error:", err);
      alert("Reject failed: " + err.message);
    }
  };

  const rejectEvent = async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .update({ status: "rejected" })
        .eq("id", eventId)
        .select();

      if (error) throw error;

      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      console.error("rejectEvent error", err);
      alert("Failed to reject event");
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
          <button
            className={`admin-nav-item ${activeTab === "refunds" ? "active" : ""}`}
            onClick={() => setActiveTab("refunds")}
          >
            <IndianRupee size={20} />
            <span>
              Refund Requests (
              {refundRequests.filter((r) => r.status === "pending").length})
            </span>
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
            {activeTab === "refunds" && "Refund Requests"}
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
                      <th>Warnings</th>
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
                          3{" "}
                          <span
                            className={`warning-badge ${user.warningCount > 0 ? "has-warning" : ""}`}
                          >
                            {user.warningCount || 0}
                          </span>
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
                            {/* Ban/Unban Button */}
                            <button
                              className={`action-btn ${user.status === "Banned" ? "unban" : "ban"}`}
                              onClick={() => toggleUserStatus(user.id)}
                              title={
                                user.status === "Banned"
                                  ? "Unban user"
                                  : "Ban user"
                              }
                            >
                              {user.status === "Banned" ? (
                                <CheckCircle size={16} />
                              ) : (
                                <Ban size={16} />
                              )}
                            </button>

                            {/* New Warning Button - Replace RotateCcw with AlertTriangle */}
                            <button
                              className="action-btn warn"
                              onClick={() => sendWarning(user.id, user.name)}
                              title="Send Warning"
                            >
                              <AlertTriangle size={16} />
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
                  <button
                    onClick={() => rejectUpload(item)}
                    className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-lg font-bold"
                  >
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
                    onClick={() => verifyPayment(payment)}
                    className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg"
                  >
                    Verify & Unlock 10 Uploads
                  </button>
                </div>
              </div>
            ))}

          {/* REFUNDS TAB */}
          {activeTab === "refunds" && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold mb-6">Refund Requests</h2>
              {refundRequests.length === 0 ? (
                <p className="text-gray-400 text-center py-10">
                  No refund requests yet
                </p>
              ) : (
                <div className="grid gap-6">
                  {refundRequests.map((req) => (
                    <div key={req.id} className="bg-gray-800 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xl font-bold">
                            {req.user_name} - {req.event_title}
                          </p>
                          <p className="text-gray-400">
                            Requested:{" "}
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-gray-300 mt-2">
                            <strong>Reason:</strong> {req.reason}
                          </p>
                          <p className="text-gray-300 mt-2">
                            <strong>Amount:</strong> ${req.amount}
                          </p>
                          <p className="text-gray-300 mt-2">
                            <strong>Venue:</strong> {req.venue}
                          </p>
                          <p className="text-gray-300 mt-2">
                            <strong>QR Code:</strong> {req.qr_code}
                          </p>
                        </div>
                        <span className={`status-badge ${req.status}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-4 mt-4">
                          <button
                            onClick={() =>
                              approveRefund(req.id, req.ticket_id, req)
                            }
                            className="bg-green-600 ..."
                          >
                            Approve Refund
                          </button>
                          <button
                            onClick={() => rejectRefund(req.id)}
                            className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
