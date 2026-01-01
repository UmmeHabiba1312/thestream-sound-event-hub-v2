import React from 'react';
import { Link } from 'react-router-dom';
import { Video, Music, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import './Home.css';
import { motion } from "framer-motion";
import gsap from "gsap";

const Home = () => {
const wordsArray = "Dive into the future of entertainment. Stream your favorite shows, catch live concerts, and discover music that moves you.".split(" ");
const [words, setWords] = React.useState([wordsArray[0]]); // first word visible

React.useEffect(() => {
  let index = 1;
  const interval = setInterval(() => {
    if (index < wordsArray.length) {
      setWords(wordsArray.slice(0, index + 1));
      index++;
    } else {
      clearInterval(interval);
    }
  }, 120); // premium typing speed
  return () => clearInterval(interval);
}, []);

  const features = [
    {
      icon: Video,
      title: 'Video Streaming',
      description: 'Watch and stream your favorite content in HD quality',
      link: '/videos',
      gradient: 'from-primary to-primary-glow'
    },
    {
      icon: Music,
      title: 'Music Marketplace',
      description: 'Discover and purchase exclusive tracks from top artists',
      link: '/music',
      gradient: 'from-accent to-primary'
    },
    {
      icon: Calendar,
      title: 'Event Tickets',
      description: 'Book tickets for the hottest events and concerts',
      link: '/events',
      gradient: 'from-primary-glow to-accent'
    }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
         <div className="hero-bg-overlay"></div>
        <div className="hero-content animate-slide-in">
          <div className="hero-badge">
            <Sparkles size={16} />
            <span>Premium Entertainment Platform</span>
          </div>
       
{/* =====  Hero Section Start ===== */}
        <div className="premium-hero-wrapper">

          {/* Cinematic Heading */}
        <motion.h1
          className="premium-hero-title"
          initial={{ opacity: 0, y: 50 }}      // start slightly below
          animate={{ opacity: 1, y: 0 }}       // slide up into position
          transition={{
            duration: 1.5,                     // smooth fade & slide
            ease: "easeOut",
          }}
        >
          Experience <span className="glow-word">Music.</span>
          <br />
          Live <span className="glow-word">Events.</span>
          <br />
          Endless <span className="glow-word">Streaming.</span>
        </motion.h1>

          {/* Premium Typing Paragraph */}
          <motion.p
            className="premium-typewriter"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.15 }
              }
            }}
          >
            {words.map((word, i) => (
              <motion.span
          key={i}
          className="premium-desc-word"
          style={{ display: 'inline-block', verticalAlign: 'top' }} // <-- important
          variants={{
            hidden: { opacity: 0, y: 0 },   // remove vertical shift
            visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
          }}
        >
          {word}&nbsp;
        </motion.span>

            ))}
          </motion.p>
        </div>
{/* ===== Hero Section End ===== */}


     <div className="hero-actions">
  <Link to="/videos" className="hero-btn hero-btn-watch">
    <Video size={20} />
    Start Watching
  </Link>
  <Link to="/music" className="hero-btn hero-btn-music">
    <Music size={20} />
    Explore Music
  </Link>
</div>

        </div>
        <div className="hero-visual animate-float">
          <div className="visual-orb orb-1"></div>
          <div className="visual-orb orb-2"></div>
          <div className="visual-orb orb-3"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <TrendingUp className="section-icon" />
          <h2 className="section-title">Explore Our Platforms</h2>
          <p className="section-subtitle">Everything you need for entertainment in one place</p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="feature-card hover-lift"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="feature-icon-wrapper">
                <feature.icon size={32} className="feature-icon" />
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="feature-arrow">→</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-item animate-scale-in">
            <div className="stat-number">10M+</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-item animate-scale-in" style={{ animationDelay: '0.1s' }}>
            <div className="stat-number">500K+</div>
            <div className="stat-label">Content Creators</div>
          </div>
          <div className="stat-item animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <div className="stat-number">1M+</div>
            <div className="stat-label">Premium Tracks</div>
          </div>
          <div className="stat-item animate-scale-in" style={{ animationDelay: '0.3s' }}>
            <div className="stat-number">50K+</div>
            <div className="stat-label">Live Events</div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
