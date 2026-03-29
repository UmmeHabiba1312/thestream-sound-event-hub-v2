import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      alert("Password updated successfully! Ab aap login kar sakte hain.");
      await supabase.auth.signOut(); // Logout taake naye password se login ho
      navigate("/login");
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <h2>Set New Password</h2>
          <p style={{ color: "#888", marginBottom: "20px" }}>
            Apna naya password yahan enter karein.
          </p>

          <form onSubmit={handleUpdate} className="login-form">
            <div className="form-group">
              <label>
                <Lock size={18} /> New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            {message && <p className="error-message">{message}</p>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
