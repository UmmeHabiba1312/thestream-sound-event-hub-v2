import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import './Signup.css';
import { supabase } from '../lib/supabase';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);   // ← YE THA MISSING!
  const [error, setError] = useState('');
  const navigate = useNavigate();

 const handleSignup = async (e) => {
  e.preventDefault();
  setError('');

  if (password !== confirmPassword) {
    setError("Passwords don't match!");
    return;
  }
  if (!agreeTerms) {
    setError("Please agree to Terms & Privacy Policy");
    return;
  }

  // YE SABSE ZAROORI CHANGE — sirf auth.signUp karo, profile manually mat banao!
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name.trim() || 'User'  // ← Trigger isko use karega
      }
    }
  });

  if (error) {
    setError(error.message);
    return;
  }

  // YE LINE HATA DO — Trigger khud bana dega profile!
  // await supabase.from('profiles').upsert({...})

  // Success message
  alert('Signup successful! Please check your email to confirm your account.');
  navigate('/login');
};

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-card">
          <div className="signup-logo">
            <div className="logo-icon-large">
              <Video className="logo-video-large" />
            </div>
            <h1 className="logo-text-large">Join StreamHub</h1>
            <p className="logo-subtitle">Create your account and start sharing today.</p>
          </div>

          <form onSubmit={handleSignup} className="signup-form">
            {error && <div className="error-message"><span>{error}</span></div>}

            <div className="form-group">
              <label htmlFor="name"><User size={18} /> Full Name</label>
              <input id="name" type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} className="form-input" />
            </div>

            <div className="form-group">
              <label htmlFor="email"><Mail size={18} /> Email Address</label>
              <input id="email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" required />
            </div>

            <div className="form-group">
              <label htmlFor="password"><Lock size={18} /> Password</label>
              <div className="password-input-wrapper">
                <input id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword"><Lock size={18} /> Confirm Password</label>
              <div className="password-input-wrapper">
                <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" required />
                <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <label className="terms-checkbox">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
              <span>I agree to the <Link to="/privacy">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link></span>
            </label>

            <button type="submit" className="signup-btn">Create Account</button>
          </form>

          <div className="login-link">
            <p>Already have an account? <Link to="/login">Login here</Link></p>
          </div>
          <div className="privacy-link">
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>

        <div className="signup-illustration">
          <div className="illustration-content">
            <h2>Welcome Aboard!</h2>
            <p>Upload unlimited content</p>
            <p>Build your audience</p>
            <p>Monetize your creativity</p>
            <p>Join millions of creators</p>
            <div className="illustration-gradient"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;