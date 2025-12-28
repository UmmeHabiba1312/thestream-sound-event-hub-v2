import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import VideoCard from '../components/video/VideoCard';
import MusicCard from '../components/music/MusicCard';
import MusicPlayer from '../components/music/MusicPlayer';
import './UserProfile.css'; // Ensure styling is there

export const UserProfileHome = ({ userId }) => {
  const [videos, setVideos] = useState([]);
  const [musicTracks, setMusicTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 1. Fetch All Videos
      const { data: videoData } = await supabase
        .from('videos')
        .select('*')
        .eq('uploaded_by', userId)
        .order('created_at', { ascending: false });

      if (videoData) {
        setVideos(videoData.map(v => ({
          ...v,
          videoUrl: supabase.storage.from('video').getPublicUrl(v.video_url).data.publicUrl,
          thumbnailUrl: v.thumbnail_url 
             ? supabase.storage.from('thumbnails').getPublicUrl(v.thumbnail_url).data.publicUrl 
             : '/default-thumbnail.jpg'
        })));
      }

      // 2. Fetch All Music
      const { data: musicData } = await supabase
        .from('content_uploads')
        .select('*, profiles(full_name)')
        .eq('uploaded_by', userId)
        .eq('type', 'audio')
        .order('created_at', { ascending: false });

      if (musicData) {
        setMusicTracks(musicData.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.profiles?.full_name || 'Unknown',
          price: t.price,
          albumArt: t.cover_path
            ? supabase.storage.from('thumbnails').getPublicUrl(t.cover_path).data.publicUrl
            : '/default-thumbnail.jpg',
          audioUrl: supabase.storage.from('content').getPublicUrl(t.file_path).data.publicUrl
        })));
      }

      setLoading(false);
    };

    if (userId) fetchData();
  }, [userId]);

  if (loading) return <p className="text-white">Loading content...</p>;

  return (
    <div className="profile-home-container">
      
      {/* --- VIDEOS SECTION --- */}
      <div className="section mb-8">
        <h3 style={{ color: 'white', fontSize: '20px', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Uploaded Videos ({videos.length})
        </h3>
        
        {videos.length > 0 ? (
          <div className="container-fluid px-0">
            <div className='row g-4'>
            {videos.map(video => (
            <div className ="col-12 col-sm-6 col-md-4 col-lg-3">
              <VideoCard key={video.id} video={video} />
                </div>
            ))}
          </div>
          </div>
        ) : (
          <p className="text-gray-500">No videos uploaded yet.</p>
        )}
      </div>

      {/* --- MUSIC SECTION --- */}
      <div className="section">
        <h3 style={{ color: 'white', fontSize: '20px', marginBottom: '15px', marginTop: '40px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
          Released Music ({musicTracks.length})
        </h3>

        {musicTracks.length > 0 ? (
          <div className="profile-music-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {musicTracks.map(track => (
              <MusicCard 
                key={track.id} 
                track={track} 
                onPlay={() => setCurrentTrack(track)} 
                onPurchase={() => {}} // Disabled on profile
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No music released yet.</p>
        )}
      </div>
        {currentTrack && (
      <MusicPlayer 
        currentTrack={currentTrack} 
        onNext={() => {
          const index = musicTracks.findIndex(t => t.id === currentTrack.id);
          const nextTrack = musicTracks[index + 1] || musicTracks[0];
          setCurrentTrack(nextTrack);
        }}
        onPrev={() => {
          const index = musicTracks.findIndex(t => t.id === currentTrack.id);
          const prevTrack = musicTracks[index - 1] || musicTracks[musicTracks.length - 1];
          setCurrentTrack(prevTrack);
        }}
        onClose={() => setCurrentTrack(null)}
      />
    )}

    </div>
  );
};