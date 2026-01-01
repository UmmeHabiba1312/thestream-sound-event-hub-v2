// src/pages/TicketPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Ticket from "../pages/Ticket";
import { useNavigate } from "react-router-dom";
import ResaleButton from "./ResaleButton"; // ya jo path hai

const TicketPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null); // ← YEH ADD KAR DO
  const navigate = useNavigate();
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      navigate("/login");
      return;
    }

    setUser(currentUser); // ← User state mein save kar do

    const { data, error } = await supabase
      .from("tickets")
      .select("*, events(*)")
      .eq("owner_id", currentUser.id)
      .order("purchased_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      setLoading(false);
      return;
    }

    const { data: refundData, error: refundError } = await supabase
      .from("refund_requests")
      .select("ticket_id")
      .in(
        "ticket_id",
        data.map((t) => t.id),
      )
      .eq("status", "pending");

    if (refundError) console.error(refundError);

    const pendingRefundTicketIds = new Set(
      refundData?.map((r) => r.ticket_id) || [],
    );

    const enrichedTickets = data.map((ticket) => ({
      ...ticket,
      has_pending_refund: pendingRefundTicketIds.has(ticket.id),
    }));

    setTickets(enrichedTickets || []);
    setLoading(false);
  };

  const requestRefund = async (ticketId, reason) => {
    const { error } = await supabase.from("refund_requests").insert({
      ticket_id: ticketId,
      reason: reason,
    });

    if (error) alert("Refund request failed");
    else alert("Refund request submitted – admin will review");
  };

  const openRefundModal = (ticket) => {
    setSelectedTicket(ticket);
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setSelectedTicket(null);
  };

  const submitRefundRequest = async (reason) => {
    if (!reason.trim()) {
      alert("Please enter a reason for refund");
      return;
    }

    // Amount calculate: resale ticket tha to resale_price, warna original_price
    const refundAmount =
      selectedTicket.resale_price ||
      selectedTicket.original_price ||
      selectedTicket.events.ticket_price;

    const { error } = await supabase.from("refund_requests").insert({
      ticket_id: selectedTicket.id,
      user_id: user.id,
      reason: reason.trim(),
      amount: refundAmount, // ← YE ADD KAR DO
    });

    if (error) {
      console.error("Refund request error:", error);
      alert("Failed to submit refund request: " + error.message);
    } else {
      alert("Refund request submitted successfully! Admin will review it.");
      closeRefundModal();
      fetchTickets(); // refresh
    }
  };
  useEffect(() => {
    fetchTickets();
  }, [navigate]);

  if (loading) {
    return (
      <div className="text-center text-white text-3xl mt-40">
        Loading your tickets...
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center text-white mt-40">
        <h1 className="text-4xl mb-8">No tickets yet</h1>
        <button onClick={() => navigate("/events")} className="btn-primary">
          Browse Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-10">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-5xl text-white font-bold text-center mb-12">
          My Tickets ({tickets.length})
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
            >
              <Ticket
                eventName={ticket.events.title}
                ticketType="General Admission"
                venue={ticket.events.venue}
                date={new Date(ticket.events.event_datetime).toDateString()}
                time={new Date(ticket.events.event_datetime).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
                qrCode={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(ticket.qr_code)}`}
                ticketId={`#${ticket.id.substring(0, 8).toUpperCase()}`}
              />

              <div className="p-6">
                <p className="text-center text-green-400 font-semibold mb-4">
                  Status: {ticket.status.toUpperCase()}
                </p>

                {/* Active ticket - resale button */}
                {!ticket.refund_requested &&
                  ticket.status === "active" &&
                  !ticket.is_for_resale && (
                    <ResaleButton
                      ticket={ticket}
                      onSuccess={fetchTickets}
                      user={user}
                    />
                  )}

                {/* Listed for resale */}
                {ticket.is_for_resale && ticket.status === "active" && (
                  <p className="text-center text-yellow-400 font-bold text-xl">
                    Listed for resale at ${ticket.resale_price}
                  </p>
                )}

                {/* Sold on resale */}
                {ticket.status === "sold_resale" && (
                  <p className="text-center text-gray-400 font-bold text-xl">
                    Sold on Resale
                  </p>
                )}

                {!ticket.has_pending_refund &&
                  ticket.status === "active" &&
                  new Date(ticket.events.event_datetime) > new Date() && (
                    <button
                      onClick={() => openRefundModal(ticket)}
                      className="btn-red mt-4"
                    >
                      Request Refund
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showRefundModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-2xl max-w-lg w-full mx-4">
            <h2 className="text-3xl text-white font-bold mb-6 text-center">
              Request Refund
            </h2>
            <p className="text-gray-300 mb-2">
              <strong>Event:</strong> {selectedTicket.events.title}
            </p>
            <p className="text-gray-300 mb-6">
              <strong>Venue:</strong> {selectedTicket.events.venue}
            </p>
            <textarea
              id="refund-reason"
              className="w-full p-4 bg-gray-800 text-white rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-red-600"
              rows="5"
              placeholder="Please explain why you want a refund..."
            />
            <div className="flex gap-4">
              <button
                onClick={closeRefundModal}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const reason = document.getElementById("refund-reason").value;
                  submitRefundRequest(reason);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketPage;
