import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Video, Mail, Lock, Eye, EyeOff, Zap, ArrowLeft } from "lucide-react";
import "./Login.css";
import { supabase } from "../lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // States for OTP Reset
  const [isResetting, setIsResetting] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    setError("");

    try {
      // 1. Force logout and clear all local data first
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();

      // 2. Request OTP
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) {
        setError(error.message);
      } else {
        alert("OTP sent! Please check your email.");
        setIsResetting(true);
      }
    } catch (err) {
      setError("Server error. Please try again in 15 minutes.");
    }
  };

  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // 1. Verify OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "recovery",
      });

      if (verifyError) {
        setError("Invalid OTP or expired. Please try again.");
        return;
      }

      // 2. Chota sa delay (300ms) taake session set ho jaye
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3. Update Password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        // Agar yahan 422 aye, to iska matlab "Secure password change" ON hai
        setError("Update failed: " + updateError.message);
      } else {
        alert("Success! Password updated.");
        setIsResetting(false);
        navigate("/login");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "admin") {
      window.location.href = "/admin";
    } else {
      navigate("/");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="logo-icon-large">            
           <img src="/assets/logo.jpeg" alt="logo" className="logo-image" />
            </div>
            <h1 className="logo-text-large">StreamHub</h1>
            <p className="logo-subtitle">
              {isResetting
                ? "Reset your password"
                : "Welcome back! Please login to your account."}
            </p>
          </div>

          {/* Conditional Rendering Starts Here */}
          {isResetting ? (
            /* --- OTP RESET FORM --- */
            <form onSubmit={handleVerifyAndReset} className="login-form">
              {error && (
                <div className="error-message">
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label>
                  <Mail size={18} /> OTP Code
                </label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <Lock size={18} /> New Password
                </label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <button type="submit" className="login-btn">
                Verify & Update Password
              </button>

              <button
                type="button"
                className="back-to-login"
                onClick={() => setIsResetting(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#888",
                  marginTop: "15px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
            </form>
          ) : (
            /* --- NORMAL LOGIN FORM --- */
            <form onSubmit={handleLogin} className="login-form">
              {error && (
                <div className="error-message">
                  <span>{error}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={18} /> Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <Lock size={18} /> Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="remember-me">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="forgot-password-btn"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#007bff",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login-btn">
                Login to StreamHub
              </button>

              <div className="admin-hint">
                <Zap size={16} />
                <span>Use admin@example.com to access Admin Panel</span>
              </div>
            </form>
          )}

          <div className="signup-link">
            <p>
              Don't have an account? <Link to="/signup">Sign up now</Link>
            </p>
          </div>

          <div className="privacy-link">
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>

        <div className="login-illustration">
          <div className="illustration-content">
            <h2>Start Your Journey</h2>
            <p>Upload unlimited music and videos</p>
            <p>Connect with millions of creators</p>
            <p>Build your audience worldwide</p>
            <div className="illustration-gradient"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
