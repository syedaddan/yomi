import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

export default function AccountPanel({
  user,
  profile,
  onOpenAccount,
  configured,
  authReady,
  syncStatus,
  syncError,
  migrationRequired,
  hasCloudData,
  hasLocalData,
  onImportLocal,
  onUseCloud,
  onStartFresh,
  onRetrySync,
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authReady && !user && !promptDismissed) setDialogOpen(true);
  }, [authReady, user, promptDismissed]);
  useEffect(() => {
    if (user) setPromptDismissed(true);
  }, [user]);
  useEffect(() => {
    if (migrationRequired) setDialogOpen(true);
  }, [migrationRequired]);

  async function signInWithGoogle() {
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (authError) setError(authError.message);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in could not start.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      setEmailSent(true);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'The sign-in email could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) setError(authError.message);
      else setDialogOpen(false);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  function closePrompt() {
    setPromptDismissed(true);
    setDialogOpen(false);
  }

  return (
    <>
      <div className={`account-status${user ? ' is-signed-in' : ''}`}>
        {user ? (
          <button className="account-avatar-button" type="button" onClick={onOpenAccount} aria-label="Open account page">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="account-avatar" />
              : <span className="account-avatar account-avatar-placeholder">{(profile?.display_name || user.email || '?').slice(0, 1).toUpperCase()}</span>}
          </button>
        ) : (
          <button className="account-status-button" type="button" onClick={() => setDialogOpen(true)}>
            Save progress
          </button>
        )}
        {!user && (
          <span className="account-reminder">
            Rated progress stays on this device. Your current drill round resets on refresh. Register or sign in to sync progress and carry new work between devices.
          </span>
        )}
        {user && syncStatus === 'error' && <span className="account-sync-warning">Cloud sync needs attention.</span>}
      </div>

      {dialogOpen && (
        <div className="account-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && (promptDismissed || user)) setDialogOpen(false);
        }}>
          <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <button className="account-close" type="button" aria-label="Close" onClick={() => user ? setDialogOpen(false) : closePrompt()}>×</button>
            {migrationRequired ? (
              <>
                <h2 id="account-title">Choose which progress to keep</h2>
                <p className="hint">
                  {hasCloudData
                    ? 'This account already has cloud progress. Merge this device or load the cloud copy; your browser data remains saved locally. Merging adds ratings, so duplicate study history on both devices can count twice.'
                    : 'Transfer this device’s saved progress and custom words to your account, or start with an empty cloud profile. Your browser copy remains saved locally.'}
                </p>
                {hasLocalData && (
                  <button className="btn primary account-action" type="button" disabled={syncStatus === 'loading'} onClick={onImportLocal}>
                    {hasCloudData ? 'Merge this device into cloud' : 'Transfer this device'}
                  </button>
                )}
                {hasCloudData ? (
                  <button className="btn account-action" type="button" disabled={syncStatus === 'loading'} onClick={onUseCloud}>Use cloud progress</button>
                ) : (
                  <button className="btn account-action" type="button" disabled={syncStatus === 'loading'} onClick={onStartFresh}>Start with empty cloud progress</button>
                )}
                {syncStatus === 'error' && <p className="account-error" role="alert">{syncError}</p>}
              </>
            ) : user ? (
              <>
                <h2 id="account-title">Your Yomi account</h2>
                <p>{user.email || 'Signed in with Google'}</p>
                <p className="hint">
                  {syncStatus === 'ready' ? 'Progress is syncing to your account.' : syncStatus === 'loading' ? 'Loading your cloud progress…' : 'Cloud sync is not ready.'}
                </p>
                {syncStatus === 'error' && (
                  <div className="account-error" role="alert">
                    {syncError}
                    <button className="btn" type="button" onClick={onRetrySync}>Retry sync</button>
                  </div>
                )}
                <button className="btn primary account-action" type="button" onClick={() => {
                  setDialogOpen(false);
                  onOpenAccount();
                }}>Open account page</button>
                <button className="btn account-action" type="button" disabled={busy} onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <h2 id="account-title">Save your Yomi progress</h2>
                <p className="hint">Create an account or sign in to sync progress and move it between devices. It takes one tap with Google or one email link—no password.</p>
                {!configured ? (
                  <p className="account-error" role="status">Account sign-in is not configured yet. You can keep using Yomi on this device.</p>
                ) : (
                  <>
                    <button className="btn primary account-action" type="button" disabled={busy} onClick={signInWithGoogle}>Continue with Google</button>
                    <form className="account-email-form" onSubmit={sendMagicLink}>
                      <label htmlFor="account-email">Or get a sign-in link by email</label>
                      <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                      <button className="btn account-action" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
                    </form>
                    {emailSent && <p className="account-success" role="status">Check your inbox for your sign-in link. You can close this and continue studying.</p>}
                  </>
                )}
                {syncStatus === 'error' && <p className="account-error" role="alert">{syncError}</p>}
                {error && <p className="account-error" role="alert">{error}</p>}
                <button className="account-dismiss" type="button" onClick={closePrompt}>Continue without an account</button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
