// src/App.jsx ← Pura file replace kar do
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import Home from "./pages/Home";
import Videos from "./pages/Videos";
import VideoPlayer from "./pages/VideoPlayer";
import Music from "./pages/Music";
import Events from "./pages/Events";
import Subscription from "./pages/Subscription";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminPanel from "./pages/AdminPanel";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import { supabase } from "./lib/supabase";
import UserProfile from "./pages/UserProfile";
import PaymentSuccess from "./pages/PaymentSuccess";
import ResetPassword from "./pages/ResetPassword";
import Ticket from "./pages/Ticket";
import { useNavigate } from "react-router-dom";
import SplashCursor from "./SplashCursor";
import Library from './pages/Library';
const queryClient = new QueryClient();

// Sabse safe Protected Route
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (requireAdmin) {
    const isAdmin = session.user.email === "admin@example.com";
    if (!isAdmin) {
      // Profile se bhi check kar lo
      supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => {
          if (data?.role !== "admin") {
            return <Navigate to="/" replace />;
          }
        });
      if (!isAdmin) return <Navigate to="/" replace />;
    }
  }

  return children;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
         <SplashCursor />
        <Navigation />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />

          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<UserProfile />} />

          <Route path="/videos" element={<Videos />} />
          <Route path="/video/:id" element={<VideoPlayer />} />
          <Route path="/music" element={<Music />} />
          <Route path="/events" element={<Events />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/library" element={<Library />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/user/:id" element={<UserProfile />} />
          <Route path="/ticket/:id" element={<Ticket />} />

          {/* Admin Route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
};

export default App;
