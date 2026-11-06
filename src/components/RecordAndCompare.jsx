import React, { useEffect, useRef, useState } from 'react';
import {
  extractPitchContour,
  getItemMorae,
  getItemPitchPattern,
  scoreMoraPitch,
  segmentMorae,
} from '../pitchDetection.js';
import { createRecorder, isRecordingSupported, mapRecordingError } from '../audioRecorder.js';
import PitchContourGraph from './PitchContourGraph.jsx';

export default function RecordAndCompare({
  item,
  onPlayReference,
  notify,
  onRecordingChange,
}) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [contour, setContour] = useState([]);
  const [moraSegments, setMoraSegments] = useState([]);
  const [scoreResult, setScoreResult] = useState(null);
  const [error, setError] = useState('');

  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const maxSeconds = Math.min(6, Math.max(3, (item?.moraCount || 3) * 0.85));

  const morae = getItemMorae(item);
  const targetPattern = getItemPitchPattern(item);

  // Clean up recording and audio URLs on unmount or item change
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel();
        recorderRef.current = null;
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Reset recording when item changes
  useEffect(() => {
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setAnalyzing(false);
    setRecordingSeconds(0);
    setAudioUrl(null);
    setContour([]);
    setMoraSegments([]);
    setScoreResult(null);
    setError('');
  }, [item?.id]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest('input, select, textarea')) return;
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          startRecording();
        } else if (recording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, recording, maxSeconds, morae.length, targetPattern]);

  async function startRecording() {
    setError('');
    if (!isRecordingSupported()) {
      const msg = 'Microphone recording is not supported in this browser.';
      setError(msg);
      notify?.(msg);
      return;
    }

    try {
      const rec = await createRecorder();
      recorderRef.current = rec;
      setRecording(true);
      setRecordingSeconds(0);

      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingSeconds(elapsed);
        if (elapsed >= maxSeconds) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      const friendly = mapRecordingError(err);
      setError(friendly);
      notify?.(friendly);
      setRecording(false);
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;

    setRecording(false);
    setAnalyzing(true);

    try {
      const { blob, audioUrl: newUrl, pcmData, sampleRate } = await recorderRef.current.stop();
      recorderRef.current = null;
      setAudioUrl(newUrl);

      // Analyze pitch on PCM audio
      const frames = extractPitchContour(pcmData, sampleRate);
      setContour(frames);

      const segments = segmentMorae(frames, morae.length);
      setMoraSegments(segments);

      const result = scoreMoraPitch(segments, targetPattern);
      setScoreResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not analyze recording.';
      setError(msg);
      notify?.(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  function playLearnerAudio() {
    if (!audioUrl) return;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    const player = new Audio(audioUrl);
    audioPlayerRef.current = player;
    player.play().catch(() => notify?.('Could not play your recording.'));
  }

  return (
    <div className={`record-compare-panel${open ? ' is-open' : ''}`} id="record-compare">
      <div className="record-compare-toggle-row">
        <button
          className={`btn ${open ? 'active' : ''}`}
          type="button"
          aria-expanded={open}
          aria-controls="record-compare-body"
          onClick={() => setOpen((prev) => !prev)}
        >
          🎙️ Record & compare pitch <kbd>R</kbd>
        </button>
      </div>

      {open && (
        <div className="record-compare-body" id="record-compare-body">
          <div className="record-compare-header">
            <div className="record-actions">
              {!recording ? (
                <button
                  className="btn primary record-btn"
                  type="button"
                  onClick={startRecording}
                  disabled={analyzing}
                >
                  <span className="rec-dot" aria-hidden="true" />
                  {audioUrl ? 'Record again' : 'Start recording'} <kbd>R</kbd>
                </button>
              ) : (
                <button
                  className="btn miss record-btn is-recording"
                  type="button"
                  onClick={stopRecording}
                >
                  <span className="rec-pulse-dot" aria-hidden="true" />
                  Stop recording ({recordingSeconds.toFixed(1)}s / {maxSeconds.toFixed(0)}s) <kbd>R</kbd>
                </button>
              )}

              {audioUrl && !recording && (
                <button
                  className="btn"
                  type="button"
                  onClick={playLearnerAudio}
                >
                  ▶ Hear your recording
                </button>
              )}

              {onPlayReference && !recording && (
                <button
                  className="btn"
                  type="button"
                  onClick={onPlayReference}
                >
                  ▶ Hear reference
                </button>
              )}
            </div>

            {error && <p className="record-error" role="alert">{error}</p>}
            {analyzing && <p className="hint">Analyzing pitch contour…</p>}
          </div>

          {/* Pitch Contour SVG Graph */}
          <PitchContourGraph
            morae={morae}
            targetPattern={targetPattern}
            learnerContour={contour}
            moraSegments={moraSegments}
            moraResults={scoreResult?.moraResults || []}
            score={scoreResult?.score}
          />

          {/* Mora Level Score Card & Feedback */}
          {scoreResult && scoreResult.score !== null && (
            <div className={`mora-score-card ${scoreResult.passed ? 'pass' : 'fail'}`}>
              <div className="mora-score-header">
                <span className={`mora-score-pill ${scoreResult.score >= 80 ? 'good' : scoreResult.score >= 50 ? 'warn' : 'miss'}`}>
                  Mora score: {scoreResult.score}%
                </span>
                <span className="mora-score-feedback">{scoreResult.feedback}</span>
              </div>

              {/* Mora-by-mora breakdown */}
              <div className="mora-breakdown-list">
                {scoreResult.moraResults.map((m, idx) => (
                  <div
                    key={`score-mora-${idx}`}
                    className={`mora-breakdown-item ${m.actual === 'unvoiced' ? 'unvoiced' : m.match ? 'match' : 'mismatch'}`}
                  >
                    <span className="mora-kana">{morae[idx] || `Mora ${idx + 1}`}</span>
                    <span className="mora-target">Expected: <b>{m.expected}</b></span>
                    <span className="mora-actual">
                      Spoke: <b>{m.actual === 'unvoiced' ? 'silent' : m.actual}</b>
                      {m.pitch ? <small> ({m.pitch} Hz)</small> : null}
                    </span>
                    <span className="mora-status-icon" aria-hidden="true">
                      {m.actual === 'unvoiced' ? '–' : m.match ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
