import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CheckCircle, XCircle, Loader } from "lucide-react";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("Verifying payment details...");

  useEffect(() => {
    const savePurchase = async () => {
      // 1. URL se data nikalo (Stripe bhejta hai)
      const trackId = searchParams.get("track_id");
      const userId = searchParams.get("user_id");
      const price = searchParams.get("price");

      // Debugging: Console check karein ki data aaya ya nahi
      console.log("Payment Return Data:", { trackId, userId, price });

      if (!trackId || !userId || !price) {
        setStatus("error");
        setMessage("Error: Invalid payment data. URL parameters missing.");
        return;
      }

      try {
        // 2. Database function call karein (RPC)
        const { error } = await supabase.rpc("process_purchase", {
          p_track_id: trackId,
          p_buyer_id: userId,
          p_amount: parseFloat(price),
        });

        if (error) {
          // Agar user ne pehle se khareeda hai toh error nahi maana jayega
          if (
            error.message.includes("unique constraint") ||
            error.message.includes("duplicate")
          ) {
            setStatus("success");
            setMessage("You already own this track! (Transaction Recorded)");
          } else {
            throw error; // Real error
          }
        } else {
          setStatus("success");
          setMessage("Transaction successful! Track added to Library.");
        }
      } catch (err) {
        console.error("DB Save Error:", err);
        setStatus("error");
        setMessage("Database Error: " + err.message);
      }
    };

    // Run once on mount
    savePurchase();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {status === "loading" && (
          <>
            <Loader size={60} style={styles.spinner} />
            <h2 style={styles.title}>Processing...</h2>
            <p style={styles.text}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={80} color="#4ade80" />
            <h1 style={styles.title}>Payment Successful!</h1>
            <p style={styles.text}>{message}</p>
            <button onClick={() => navigate("/library")} style={styles.button}>
              Go to Library
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={80} color="#ef4444" />
            <h1 style={styles.title}>Something Went Wrong</h1>
            <p style={{ ...styles.text, color: "#ef4444" }}>{message}</p>
            <p style={styles.subtext}>
              If money was deducted, contact support.
            </p>
            <button
              onClick={() => navigate("/music")}
              style={{ ...styles.button, background: "#333" }}
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// Simple Styles Object
const styles = {
  container: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f0f",
    color: "white",
  },
  card: {
    textAlign: "center",
    padding: "40px",
    backgroundColor: "#1e1e1e",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    maxWidth: "400px",
    width: "90%",
  },
  spinner: {
    animation: "spin 1s linear infinite",
    marginBottom: "20px",
    color: "#3ea6ff",
  },
  title: {
    margin: "20px 0 10px",
    fontSize: "24px",
    fontWeight: "bold",
  },
  text: {
    color: "#aaa",
    fontSize: "16px",
    marginBottom: "30px",
  },
  subtext: {
    color: "#666",
    fontSize: "12px",
    marginTop: "10px",
  },
  button: {
    padding: "12px 24px",
    backgroundColor: "#3ea6ff",
    color: "black",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
  },
};

export default PaymentSuccess;
