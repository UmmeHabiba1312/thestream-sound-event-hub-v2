import React, { useState, useEffect, useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, Shuffle, Repeat, Volume1, VolumeX
} from "lucide-react";
import "./MusicPlayer.css";

const MusicPlayer = ({ currentTrack, onNext, onPrev, onClose }) => {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

const [isClosing, setIsClosing] = useState(false);

const handleClose = () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }
  setIsClosing(true); // start fade-out
  setTimeout(() => {
    onClose(); // actually unmount
  }, 300); // match transition duration
};


  // --- 1. Load Track & Play ---
  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.warn("Autoplay blocked", err));
    }
  }, [currentTrack]);

  // --- 2. Format Time (mm:ss) ---
  const formatTime = (time) => {
    if (!time || isNaN(time)) return "00:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min < 10 ? "0" + min : min}:${sec < 10 ? "0" + sec : sec}`;
  };

  // --- 3. Handle Time Update ---
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
    setProgress((audio.currentTime / audio.duration) * 100);
  };

  // --- 4. Seek ---
  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pos * duration;
  };

  // --- 5. Play/Pause ---
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  // --- 6. Handle Ended (Auto Next) ---
  const handleEnded = () => {
    if (isRepeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else if (onNext) {
      onNext(); // Parent logic for next track
    } else {
      setIsPlaying(false);
    }
  };

  // --- 7. Volume ---
  const handleVolume = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newVol = Math.min(1, Math.max(0, pos));
    setVolume(newVol * 100);
    if (audioRef.current) audioRef.current.volume = newVol;
  };

  if (!currentTrack) return null;

  return (
    <div className="music-player">
      <audio 
        ref={audioRef} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      >
        <source src={currentTrack.audioUrl} />
      </audio>

      <div className="player-content">
         
        {/* Track Info */}
        <div className="player-track-info">
          <img src={currentTrack.albumArt} alt={currentTrack.title} className="player-album-art" />
          <div className="player-text-info">
            <h4 className="player-title">{currentTrack.title}</h4>
            <p className="player-artist">{currentTrack.artist}</p>
          </div>
<button
  className="player-close-btn"
  onClick={() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    onClose(); // parent will set currentTrack to null
  }}
>
  ×
</button>



        </div>

        {/* Controls */}
        <div className="player-controls">
          <div className="control-buttons">
            <button 
                className={`control-btn ${isShuffle ? 'active' : ''}`} 
                onClick={() => setIsShuffle(!isShuffle)}
            >
              <Shuffle size={18} />
            </button>

            <button className="control-btn" onClick={onPrev}>
              <SkipBack size={20} />
            </button>

            <button className="control-btn play-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
            </button>

            <button className="control-btn" onClick={onNext}>
              <SkipForward size={20} />
            </button>

            <button 
                className={`control-btn ${isRepeat ? 'active' : ''}`} 
                onClick={() => setIsRepeat(!isRepeat)}
            >
              <Repeat size={18} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="progress-bar-wrapper">
            <span className="progress-time">{formatTime(currentTime)}</span>
            <div className="progress-bar" onClick={handleSeek}>
              <div className="progress-fill" style={{ width: `${progress}%` }}>
                <div className="progress-thumb"></div>
              </div>
            </div>
            <span className="progress-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="player-volume">
          {volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20} />}
          <div className="volume-slider" onClick={handleVolume}>
            <div className="volume-fill" style={{ width: `${volume}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;