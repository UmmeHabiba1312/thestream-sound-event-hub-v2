// src/pages/QRScanner.jsx
import React, { useState, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const QRScanner = () => {
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const navigate = useNavigate();

  // User check + apne events load karo
  useEffect(() => {
    const checkUserAndEvents = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Login required to use scanner");
        navigate("/login");
        return;
      }

      setUser(user);

      // Sirf is user ke banaye hue upcoming events fetch karo
      const { data: events, error } = await supabase
        .from("events")
        .select("id, title, event_datetime, status")
        .eq("created_by", user.id)
        .in("status", ["approved", "sold_out"])
        .gt("event_datetime", new Date().toISOString())
        .order("event_datetime", { ascending: true });

      if (error) {
        console.error("Error fetching events:", error);
        alert("Failed to load your events");
        return;
      }

      setUserEvents(events || []);

      if (events && events.length > 0) {
        setSelectedEventId(events[0].id);
      }
    };

    checkUserAndEvents();
  }, [navigate]);

  // Scanner start only when event selected
  useEffect(() => {
    if (!selectedEventId) return;

    const scanner = new Html5QrcodeScanner("reader", {
      qrbox: { width: 300, height: 300 },
      fps: 10,
      aspectRatio: 1,
    });

    const success = async (result) => {
      scanner.clear();
      await validateTicket(result);
    };

    const error = () => {
      // Silent
    };

    scanner.render(success, error);

    return () => {
      scanner.clear();
    };
  }, [selectedEventId]);

  const validateTicket = async (qrCode) => {
    setLoading(true);
    setMessage("");
    setIsSuccess(null);

    try {
      const { data: ticket, error } = await supabase
        .from("tickets")
        .select("*, events(*), profiles!owner_id(banned)")
        .eq("qr_code", qrCode)
        .single();

      if (error || !ticket) {
        throw new Error("Invalid or unknown QR code");
      }

      // 1. Ye ticket mere event ka hai ya nahi?
      if (ticket.event_id !== selectedEventId) {
        throw new Error("This ticket is not for your event!");
      }

      // 2. Ticket active hai?
      if (ticket.status !== "active") {
        throw new Error(`Ticket is already ${ticket.status}`);
      }

      // 3. User banned to nahi?
      if (ticket.profiles?.banned) {
        throw new Error("User is banned from the platform");
      }

      // 4. Event abhi end nahi hua?
      const eventDate = new Date(ticket.events.event_datetime);
      const now = new Date();
      if (eventDate < now) {
        throw new Error("This event has already ended");
      }

      // Success → ticket used mark kar do
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ status: "used" })
        .eq("id", ticket.id);

      if (updateError) throw updateError;

      setIsSuccess(true);
      setMessage(`Entry Allowed! Welcome to ${ticket.events.title}`);
    } catch (err) {
      setIsSuccess(false);
      setMessage(err.message || "Invalid QR Code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-10">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-5xl font-bold text-center mb-10">
          My Event QR Scanner
        </h1>

        {!user ? (
          <p className="text-center text-gray-400 text-2xl mt-20">Loading...</p>
        ) : userEvents.length === 0 ? (
          <p className="text-center text-gray-400 text-2xl mt-20">
            You have no upcoming events to scan tickets for.
          </p>
        ) : (
          <>
            {/* Event Selector */}
            <div className="mb-10 text-center">
              <label className="text-2xl font-semibold mr-6">
                Select Your Event:
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-gray-800 text-white px-8 py-4 rounded-xl text-xl border border-gray-600"
              >
                {userEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} —{" "}
                    {new Date(event.event_datetime).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </option>
                ))}
              </select>
            </div>

            {/* Scanner */}
            {selectedEventId && (
              <div className="bg-gray-900 rounded-3xl p-10 shadow-2xl">
                <div id="reader" className="mx-auto mb-10 max-w-lg"></div>

                {loading && (
                  <p className="text-center text-yellow-400 text-2xl font-semibold">
                    Validating ticket...
                  </p>
                )}

                {isSuccess !== null && (
                  <div
                    className={`mt-10 p-10 rounded-3xl text-center border-8 ${
                      isSuccess
                        ? "bg-green-900 border-green-500"
                        : "bg-red-900 border-red-500"
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle
                        size={100}
                        className="mx-auto text-green-400 mb-6"
                      />
                    ) : (
                      <XCircle
                        size={100}
                        className="mx-auto text-red-400 mb-6"
                      />
                    )}
                    <p className="text-4xl font-bold">{message}</p>
                  </div>
                )}

                <div className="text-center mt-12 text-gray-400">
                  <p className="text-2xl">Point camera at QR code on ticket</p>
                  <AlertTriangle
                    size={40}
                    className="mx-auto mt-6 text-yellow-400"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
