import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const UserProfileAbout = ({ user }) => {
  const [stats, setStats] = useState({ videos: 0, music: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { count: vCount } = await supabase.from('videos').select('*', { count: 'exact', head: true }).eq('uploaded_by', user.id);
      const { count: mCount } = await supabase.from('content_uploads').select('*', { count: 'exact', head: true }).eq('uploaded_by', user.id).eq('type', 'audio');
      setStats({ videos: vCount || 0, music: mCount || 0 });
    };
    if (user?.id) fetchStats();
  }, [user]);

  if (!user) return null;

  return (
    <div style={{ color: '#aaa', maxWidth: '600px' }}>
      <h3 style={{ color: 'white', marginBottom: '10px' }}>About {user.full_name}</h3>
      <p>{user.bio || "No description provided."}</p>
      <hr style={{ borderColor: '#333', margin: '20px 0' }} />
      <h3 style={{ color: 'white', marginBottom: '10px' }}>Channel Stats</h3>
      <p>Joined: {new Date(user.created_at).toLocaleDateString()}</p>
      <p>Videos Uploaded: {stats.videos}</p>
      <p>Music Tracks: {stats.music}</p>
    </div>
  );
};