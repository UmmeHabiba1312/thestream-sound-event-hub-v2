import React, { useState, useEffect } from "react";
// 1. FIXED: Added missing icon imports
import { Check, Zap, Music, Video, Radio } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import "./Subscription.css";

const Subscription = () => {
  // --- CUSTOMIZER STATES ---
  const [addMusic, setAddMusic] = useState(false);
  const [musicCount, setMusicCount] = useState(5);
  const [addVideo, setAddVideo] = useState(false);
  const [videoCount, setVideoCount] = useState(5);
  const [addStreaming, setAddStreaming] = useState(false);
  const [streamingHours, setStreamingHours] = useState(10);

  const RATE_MUSIC = 2;
  const RATE_VIDEO = 5;
  const RATE_STREAM = 2;

  const calculateTotal = () => {
    let total = 0;
    if (addMusic) total += musicCount * RATE_MUSIC;
    if (addVideo) total += videoCount * RATE_VIDEO;
    if (addStreaming) total += streamingHours * RATE_STREAM;
    return total;
  };

  const queryClient = useQueryClient();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const { data: userSubscription, isLoading } = useQuery({
    queryKey: ["userSubscription"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in");
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_plan, subscription_expires_at")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!supabase.auth.getSession(),
  });

  // 2. FIXED: Added 'customData' as a second argument to the function
  const handleSubscribe = async (planId, customData = null) => {
    const currentPlan = userSubscription?.subscription_plan || "free";

    // Only block if it's a regular plan, allow custom bundles to be bought multiple times
    if (planId === currentPlan && !customData) {
      alert("You are already on this plan.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      alert("Please log in to change your subscription.");
      return;
    }

    if (planId === "free") {
      alert("Switching to Free plan...");
      await supabase
        .from("profiles")
        .update({ subscription_plan: "free", subscription_expires_at: null })
        .eq("id", user.id);
      queryClient.invalidateQueries(["userSubscription"]);
      return;
    }

    setIsSubscribing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-checkout",
        {
          body: {
            plan_id: planId, // yahan "custom_bundle" jayega
            userId: user.id,
            // 🎯 Ye teen cheezain Stripe ko batani hain taake wo DB mein add ho saken
            music_tracks: customData?.music || 0,
            video_uploads: customData?.videos || 0,
            streaming_hours: customData?.streaming || 0,
            origin: window.location.origin,
            success_url: `${window.location.origin}/dashboard?checkout=success`,
            cancel_url: `${window.location.origin}/subscription?checkout=cancelled`,
          },
        },
      );
      if (error) throw error;
      const sessionUrl = data?.url || data?.stripe_session_url;
      if (sessionUrl) {
        window.location.href = sessionUrl;
      } else {
        throw new Error("Failed to get Stripe session URL.");
      }
    } catch (err) {
      console.error("Stripe Checkout Error:", err);
      alert(`Payment initialization failed: ${err.message}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "forever",
      uploads: "3 music videos",
      features: ["Upload up to 3 music videos"],
      buttonText: "Get Started",
      popular: false,
    },
    {
      id: "standard",
      name: "Standard",
      price: "$49",
      period: "per year",
      uploads: "10 music videos",
      features: [
        "Upload up to 10 music videos",
        " 1hr HD quality streaming",
        "Priority support",
      ],
      buttonText: "Upgrade to Standard",
      popular: true,
    },
    {
      id: "premium",
      name: "Premium",
      price: "$149",
      period: "per year",
      uploads: "Unlimited music videos",
      features: [
        "Unlimited music video uploads",
        "10hr quality streaming",
        "24/7 VIP support",
      ],
      buttonText: "Go Premium",
      popular: false,
    },
  ];

  if (isLoading) return <div>Loading subscription...</div>;
  const currentPlan = userSubscription?.subscription_plan || "free";

  return (
    <div className="subscription-page">
      <div className="subscription-header">
        <h1 className="subscription-title">
          Choose Your <span className="text-gradient">Perfect Plan</span>
        </h1>
        <p className="subscription-subtitle">
          Unlock unlimited creativity with our premium subscription plans or
          Customize your own package
        </p>
        <p className="current-plan">
          Current Plan:{" "}
          {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
        </p>
      </div>

      <div className="plans-container">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${plan.popular ? "popular" : ""} ${plan.id === currentPlan ? "current" : ""}`}
          >
            {plan.popular && (
              <div className="popular-badge">
                <Zap size={14} fill="currentColor" /> Most Popular
              </div>
            )}
            {plan.id === currentPlan && (
              <div className="current-badge">Current Plan</div>
            )}
            <div className="plan-header">
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">{plan.price}</span>
                <span className="price-period">/{plan.period}</span>
              </div>
              <p className="plan-uploads">{plan.uploads}</p>
            </div>
            <ul className="plan-features">
              {plan.features.map((feature, index) => (
                <li key={index} className="feature-item">
                  <Check className="check-icon" size={20} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              className={`plan-button ${plan.popular ? "premium" : ""}`}
              onClick={() => handleSubscribe(plan.id)}
              disabled={isSubscribing || plan.id === currentPlan}
            >
              {isSubscribing ? "Processing..." : plan.buttonText}
            </button>
          </div>
        ))}

        {/* CUSTOM BUNDLE CARD */}
        <div className="plan-card bundle-card-custom">
          <div className="plan-header">
            <h3 className="plan-name">Custom Bundle</h3>
            <div className="plan-price">
              <span className="price-amount">${calculateTotal()}</span>
              <span className="price-period">/once</span>
            </div>
            <p className="plan-uploads">Select only what you need</p>
          </div>
          <div className="custom-controls-wrapper">
            <div className={`custom-option-row ${addMusic ? "active" : ""}`}>
              <div className="option-label-group">
                <span className="option-icon-text">
                  <Music size={16} color="#dc2626" /> Music Tracks
                </span>
                <input
                  type="checkbox"
                  checked={addMusic}
                  onChange={(e) => setAddMusic(e.target.checked)}
                />
              </div>
              {addMusic && (
                <>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={musicCount}
                    onChange={(e) => setMusicCount(e.target.value)}
                    className="custom-range-input"
                  />
                  <div className="count-display">
                    {musicCount} tracks selected
                  </div>
                </>
              )}
            </div>
            <div className={`custom-option-row ${addVideo ? "active" : ""}`}>
              <div className="option-label-group">
                <span className="option-icon-text">
                  <Video size={16} color="#dc2626" /> Video Uploads
                </span>
                <input
                  type="checkbox"
                  checked={addVideo}
                  onChange={(e) => setAddVideo(e.target.checked)}
                />
              </div>
              {addVideo && (
                <>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={videoCount}
                    onChange={(e) => setVideoCount(e.target.value)}
                    className="custom-range-input"
                  />
                  <div className="count-display">
                    {videoCount} videos selected
                  </div>
                </>
              )}
            </div>
            <div
              className={`custom-option-row ${addStreaming ? "active" : ""}`}
            >
              <div className="option-label-group">
                <span className="option-icon-text">
                  <Radio size={16} color="#dc2626" /> Live Streaming
                </span>
                <input
                  type="checkbox"
                  checked={addStreaming}
                  onChange={(e) => setAddStreaming(e.target.checked)}
                />
              </div>
              {addStreaming && (
                <>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={streamingHours}
                    onChange={(e) => setStreamingHours(e.target.value)}
                    className="custom-range-input"
                  />
                  <div className="count-display">
                    {streamingHours} hours selected
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            className="plan-button premium"
            onClick={() =>
              handleSubscribe("custom_bundle", {
                music: addMusic ? musicCount : 0,
                videos: addVideo ? videoCount : 0,
                streaming: addStreaming ? streamingHours : 0,
              })
            }
            disabled={
              isSubscribing || (!addMusic && !addVideo && !addStreaming)
            }
          >
            {isSubscribing ? "Processing..." : "Purchase Bundle"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
