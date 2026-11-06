/**
 * Audio recorder abstraction for microphone capture and PCM data extraction.
 * Uses MediaRecorder and Web Audio API (decodeAudioData) for cross-browser reliability.
 */

let sharedAudioContext = null;

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export function isRecordingSupported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function'
    && (window.MediaRecorder || window.AudioContext || window.webkitAudioContext),
  );
}

export function mapRecordingError(error) {
  if (!error) return 'An error occurred while accessing the microphone.';
  const name = error.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission was denied. Please grant microphone access to record.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone was found on your device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Your microphone is currently in use by another application.';
  }
  if (name === 'SecurityError') {
    return 'Microphone capture requires a secure (HTTPS or localhost) origin.';
  }
  return error.message || 'Microphone capture failed.';
}

export async function createRecorder() {
  if (!isRecordingSupported()) {
    throw new Error('Microphone recording is not supported in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    '',
  ].find((type) => !type || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))) || '';

  const options = mimeType ? { mimeType } : undefined;
  const mediaRecorder = new MediaRecorder(stream, options);
  const audioChunks = [];

  mediaRecorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  });

  mediaRecorder.start(100);

  function stop() {
    return new Promise((resolve, reject) => {
      mediaRecorder.addEventListener('stop', async () => {
        try {
          // Stop stream tracks immediately to turn off device mic indicator
          stream.getTracks().forEach((track) => track.stop());

          const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const audioUrl = URL.createObjectURL(blob);

          // Decode audio into PCM Float32Array
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = getAudioContext();
          if (!audioCtx) {
            resolve({ blob, audioUrl, pcmData: new Float32Array(0), sampleRate: 44100, duration: 0 });
            return;
          }

          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          const pcmData = decoded.getChannelData(0);
          resolve({
            blob,
            audioUrl,
            pcmData,
            sampleRate: decoded.sampleRate,
            duration: decoded.duration,
          });
        } catch (error) {
          reject(error);
        }
      }, { once: true });

      mediaRecorder.stop();
    });
  }

  function cancel() {
    try {
      stream.getTracks().forEach((track) => track.stop());
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    } catch {
      // Ignore cleanup errors on cancellation
    }
  }

  return { stop, cancel };
}
