import React, { useEffect, useState } from 'react';

export default function AccountPage({
  user,
  profile,
  profileLoading,
  profileError,
  onSaveProfile,
  onUploadAvatar,
  onRemoveAvatar,
  onSetPassword,
  onDeleteAccount,
  onSignOut,
}) {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setDescription(profile?.description || '');
  }, [profile?.display_name, profile?.description]);

  async function submitProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await onSaveProfile({ display_name: displayName, description });
      setSuccess('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await onUploadAvatar(file);
      setSuccess('Profile picture updated.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload your profile picture.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await onSetPassword(password);
      setPassword('');
      setConfirmPassword('');
      setSuccess('Password updated. You can still sign in with Google or an email link.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError('');
    try {
      await onDeleteAccount();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your account.');
      setBusy(false);
      setDeleteConfirmation(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await onSignOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <section className="panel" id="page-account">
        <div className="card stack">
          <h2>Account</h2>
          <p className="hint">Sign in to manage your profile and account settings.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel" id="page-account">
      <div className="stack account-page">
        <header className="card account-page-heading">
          <h1>Account</h1>
          <p className="hint">{user.email}</p>
          {profile?.is_admin && <span className="account-admin-badge">Yomi admin</span>}
          {profileError && <p className="account-error" role="alert">{profileError}</p>}
        </header>

        <form className="card stack" onSubmit={submitProfile}>
          <h2>Profile</h2>
          {profileLoading && <p className="hint" role="status">Loading your saved profile…</p>}
          <div className="profile-picture-editor">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt="Your profile" className="profile-picture-large" />
              : <span className="profile-picture-large profile-picture-placeholder" aria-hidden="true">{(displayName || user.email || '?').slice(0, 1).toUpperCase()}</span>}
            <div className="avatar-actions">
              <label className="btn avatar-btn">
                Change picture
                <input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={uploadAvatar} />
              </label>
              {profile?.avatar_path && (
                <button className="btn avatar-btn" type="button" disabled={busy} onClick={async () => {
                  setBusy(true);
                  setError('');
                  setSuccess('');
                  try {
                    await onRemoveAvatar();
                    setSuccess('Profile picture removed.');
                  } catch (removeError) {
                    setError(removeError instanceof Error ? removeError.message : 'Could not remove your picture.');
                  } finally {
                    setBusy(false);
                  }
                }}>Remove picture</button>
              )}
              <small className="hint">JPG, PNG, or WebP · up to 5 MB · visible only to you.</small>
            </div>
          </div>
          <label className="account-form-field">
            Display name
            <input maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="account-form-field">
            Profile description
            <textarea maxLength={500} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short introduction (visible only to you)." />
            <small className="hint">{description.length}/500 characters · private to your account</small>
          </label>
          <button className="btn primary" type="submit" disabled={busy || profileLoading}>Save profile</button>
        </form>

        <form className="card stack" onSubmit={changePassword}>
          <h2>Set or change password</h2>
          <p className="hint">You can add a password to your account while keeping Google and email-link sign-in available.</p>
          <label className="account-form-field">
            New password
            <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="account-form-field">
            Confirm new password
            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={busy}>Update password</button>
        </form>

        <section className="card stack">
          <h2>Account actions</h2>
          <button className="btn" type="button" disabled={busy} onClick={signOut}>Sign out</button>
          {deleteConfirmation ? (
            <div className="account-delete-confirm">
              <p>This permanently deletes your account, profile, saved progress, custom words, and uploaded recordings. This cannot be undone.</p>
              <div className="confirm-row">
                <button className="btn miss" type="button" disabled={busy} onClick={deleteAccount}>{busy ? 'Deleting…' : 'Permanently delete my account'}</button>
                <button className="btn" type="button" disabled={busy} onClick={() => setDeleteConfirmation(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn miss" type="button" disabled={busy} onClick={() => setDeleteConfirmation(true)}>Delete account</button>
          )}
        </section>

        {error && <p className="account-error" role="alert">{error}</p>}
        {success && <p className="account-success" role="status">{success}</p>}
      </div>
    </section>
  );
}
