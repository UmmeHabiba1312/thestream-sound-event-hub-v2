import { supabase } from '../lib/supabase';

const handleVideoUpload = async (videoFile, videoTitle, videoDescription, videoCategory, currentUserInfo) => {
  if (!currentUserInfo?.userId) return alert("Please login to upload!");

  try {
    // Step 1: Upload video to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('video')
      .upload(`videos/${videoFile.name}`, videoFile);

    if (uploadError) throw uploadError;

    const videoFileName = uploadData.path; // storage path

    // Step 2: Insert video metadata into videos table
    const { data, error } = await supabase.from('videos').insert({
      title: videoTitle,
      description: videoDescription,
      category: videoCategory,
      video_url: videoFileName,
      uploaded_by: currentUserInfo.userId // ✅ set current user
    }).select().single();

    if (error) throw error;

    console.log("Video uploaded successfully:", data);
    return data;

  } catch (err) {
    console.error("Upload failed:", err);
  }
};
