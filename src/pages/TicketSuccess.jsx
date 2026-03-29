import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Ticket from "../pages/Ticket";

const TicketSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id"); // Get session_id from URL (set in success_url)
  const [ticket, setTicket] = useState(null);
  const [event, setEvent] = useState(null);
  const [subscription, setSubscription] = useState(null); // New: For subscription success
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPurchaseDetails = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      if (!sessionId) {
        setError("No session ID found in URL. Unable to verify purchase.");
        setLoading(false);
        return;
      }

      // Max 5 retries with delay (webhook delay ke liye)
      let attempts = 0;
      const maxAttempts = 5;
      const tryFetch = async () => {
        // Check if it's a ticket purchase (look in tickets table with stripe_session_id if you add it, or metadata logic)
        // Assuming you add 'stripe_session_id' to tickets and subscriptions tables in webhook
        const { data: ticketData, error: ticketError } = await supabase
          .from("tickets")
          .select("*, events(*)")
          .eq("stripe_session_id", sessionId) // Add this field in webhook insert
          .single();

        if (ticketData && !ticketError) {
          setTicket(ticketData);
          setEvent(ticketData.events);
          setLoading(false);
          return;
        }

        // If not ticket, check subscriptions
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_session_id", sessionId) // Add this field in webhook upsert
          .single();

        if (subData && !subError) {
          setSubscription(subData);
          setLoading(false);
          return;
        }

        // If neither found yet (webhook delay)
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(tryFetch, 2000);
        } else {
          setError("Purchase is being processed. It may take a few seconds.");
          setLoading(false);
        }
      };
      tryFetch();
    };
    fetchPurchaseDetails();
  }, [navigate, sessionId]);

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-green-400 mb-8"></div>
        <h1 className="text-4xl font-bold mb-4">Processing Your Purchase...</h1>
        <p className="text-xl text-gray-300">
          Please wait while we verify your transaction
        </p>
      </div>
    );
  }

  // Error / Not Found Yet State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-6">
        <h1 className="text-4xl font-bold text-yellow-400 mb-6">
          Almost There!
        </h1>
        <p className="text-xl text-center text-gray-300 mb-10 max-w-md">
          {error}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate("/my-tickets")}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
          >
            Go to My Tickets
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition"
          >
            Refresh This Page
          </button>
          <button
            onClick={() => navigate("/events")}
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-lg transition"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  // Ticket Success State (only show if ticket purchase)
  if (ticket && event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white py-10 px-6">
        <h1 className="text-5xl font-bold text-green-400 mb-8 animate-pulse">
          🎉 Payment Successful!
        </h1>
        <p className="text-2xl mb-12 text-gray-300">
          Here is your digital ticket:
        </p>
        <div className="max-w-md w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
          <Ticket
            eventName={event.title}
            ticketType="General Admission"
            venue={event.venue}
            date={new Date(event.event_datetime).toDateString()}
            time={new Date(event.event_datetime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
            qrCode={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
              ticket.qr_code,
            )}`}
            ticketId={`#${ticket.id.substring(0, 8).toUpperCase()}`}
          />
        </div>
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate("/")}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
          >
            View All My Tickets
          </button>
          <button
            onClick={() => navigate("/events")}
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-lg transition"
          >
            Browse More Events
          </button>
        </div>
        <p className="mt-10 text-sm text-gray-500">
          Save this page or screenshot your ticket for entry
        </p>
      </div>
    );
  }

  // Subscription Success State (show if subscription purchase)
  if (subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white py-10 px-6">
        <h1 className="text-5xl font-bold text-green-400 mb-8 animate-pulse">
          🎉 Subscription Successful!
        </h1>
        <p className="text-2xl mb-12 text-gray-300">
          Your {subscription.plan} plan is now active!
        </p>
        <div className="max-w-md w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl p-6 text-center">
          <p className="text-xl mb-4">Plan: {subscription.plan}</p>
          <p className="text-lg">
            Expires: {new Date(subscription.current_period_end).toDateString()}
          </p>
        </div>
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate("/profile")}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
          >
            Go to Profile
          </button>
          <button
            onClick={() => navigate("/events")}
            className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-lg transition"
          >
            Browse Events
          </button>
        </div>
      </div>
    );
  }

  // Fallback (if neither ticket nor subscription)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-6">
      <h1 className="text-4xl font-bold text-yellow-400 mb-6">
        Payment Verified!
      </h1>
      <p className="text-xl text-center text-gray-300 mb-10 max-w-md">
        Your purchase is complete. Check your profile for details.
      </p>
      <button
        onClick={() => navigate("/profile")}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg transition"
      >
        Go to Profile
      </button>
    </div>
  );
};

export default TicketSuccess;
