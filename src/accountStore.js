import { supabase } from './supabase.js';

function requireData(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function addAvatarUrl(profile) {
  if (!profile?.avatar_path) return { ...profile, avatarUrl: '' };
  const { data, error } = await supabase.storage
    .from('profile-avatars')
    .createSignedUrl(profile.avatar_path, 86400);
  if (error) throw new Error(`Could not load your profile picture: ${error.message}`);
  return { ...profile, avatarUrl: data.signedUrl };
}

export async function readOwnProfile(userId) {
  const result = await supabase
    .from('profiles')
    .select('user_id,email,display_name,description,avatar_path,is_admin')
    .eq('user_id', userId)
    .maybeSingle();
  const profile = requireData(result, 'Could not load your profile');
  if (!profile) throw new Error('Your profile was not created. Please sign out and sign in again.');
  return addAvatarUrl(profile);
}

export async function saveOwnProfile(userId, changes) {
  const result = await supabase
    .from('profiles')
    .update({
      display_name: changes.display_name.trim(),
      description: changes.description.trim(),
    })
    .eq('user_id', userId)
    .select('user_id,email,display_name,description,avatar_path,is_admin')
    .single();
  return addAvatarUrl(requireData(result, 'Could not save your profile'));
}

export async function uploadOwnAvatar(userId, file) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!allowedTypes.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');
  const path = `${userId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from('profile-avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(`Could not upload your profile picture: ${uploadError.message}`);
  const result = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('user_id', userId)
    .select('user_id,email,display_name,description,avatar_path,is_admin')
    .single();
  return addAvatarUrl(requireData(result, 'Could not save your profile picture'));
}

export async function removeOwnAvatar(userId) {
  const result = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('user_id', userId)
    .select('user_id,email,display_name,description,avatar_path,is_admin')
    .single();
  const profile = requireData(result, 'Could not remove your profile picture');
  const { error } = await supabase.storage.from('profile-avatars').remove([`${userId}/avatar`]);
  return {
    profile: await addAvatarUrl(profile),
    warning: error ? `Your profile was updated, but the old picture could not be removed: ${error.message}` : '',
  };
}

export async function readKanjiAvailability() {
  const result = await supabase
    .from('kanji_catalog_settings')
    .select('unlocked_count')
    .eq('singleton', true)
    .single();
  const data = requireData(result, 'Could not load Kanji lesson availability');
  return data.unlocked_count;
}

export async function publishNextKanjiLesson(unlockedCount) {
  const result = await supabase
    .from('kanji_catalog_settings')
    .update({ unlocked_count: unlockedCount + 1 })
    .eq('singleton', true)
    .select('unlocked_count')
    .single();
  return requireData(result, 'Could not unlock the next Kanji lesson').unlocked_count;
}

export async function lockLastKanjiLesson(unlockedCount) {
  const next = Math.max(1, unlockedCount - 1);
  const result = await supabase
    .from('kanji_catalog_settings')
    .update({ unlocked_count: next })
    .eq('singleton', true)
    .select('unlocked_count')
    .single();
  return requireData(result, 'Could not lock the last Kanji lesson').unlocked_count;
}
