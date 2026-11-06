import { median, moras, particlePitch, pitchPattern } from './core.js';

/**
 * Extracts all morae strings in order for a deck item.
 */
export function getItemMorae(item) {
  if (!item || !item.chunks) return [];
  return item.chunks.flatMap((chunk) => {
    const wordMoras = moras(chunk.w || '');
    const particleMoras = chunk.p ? moras(chunk.p) : [];
    return [...wordMoras, ...particleMoras];
  });
}

/**
 * Extracts target H/L pitch pattern for a deck item across all chunks.
 */
export function getItemPitchPattern(item) {
  if (!item || !item.chunks) return [];
  return item.chunks.flatMap((chunk) => {
    const wordMoras = moras(chunk.w || '');
    const particleMoras = chunk.p ? moras(chunk.p) : [];
    if (chunk.a == null) {
      return Array(wordMoras.length + particleMoras.length).fill('');
    }
    const wordPattern = pitchPattern(wordMoras.length, chunk.a);
    const partPattern = particlePitch(particleMoras.length, chunk.a);
    return [...wordPattern, ...partPattern];
  });
}

/**
 * Normalized Square Difference Function (NSDF) autocorrelation pitch detector.
 * Fast, robust, and zero-dependency pitch estimator for speech fundamentals (70 Hz - 500 Hz).
 */
export function detectPitch(frame, sampleRate, { minFreq = 70, maxFreq = 500, minRms = 0.01, clarityThreshold = 0.45 } = {}) {
  const length = frame.length;
  if (!length || sampleRate <= 0) {
    return { pitch: 0, clarity: 0, voiced: false };
  }

  // 1. RMS Energy check for silence / noise gate
  let sumSquares = 0;
  for (let i = 0; i < length; i += 1) {
    sumSquares += frame[i] * frame[i];
  }
  const rms = Math.sqrt(sumSquares / length);
  if (rms < minRms) {
    return { pitch: 0, clarity: 0, voiced: false };
  }

  // 2. Compute NSDF across lag range [1, maxLag]
  const minLag = Math.max(1, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(length - 2, Math.floor(sampleRate / minFreq));

  if (minLag >= maxLag) {
    return { pitch: 0, clarity: 0, voiced: false };
  }

  const nsdf = new Float32Array(maxLag + 2);
  for (let tau = 1; tau <= maxLag + 1; tau += 1) {
    let acf = 0;
    let m = 0;
    for (let i = 0; i < length - tau; i += 1) {
      acf += frame[i] * frame[i + tau];
      m += frame[i] * frame[i] + frame[i + tau] * frame[i + tau];
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // 3. Find first significant local maximum above clarityThreshold
  let bestLag = -1;
  let bestVal = -1;

  for (let tau = 2; tau <= maxLag; tau += 1) {
    if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1] && nsdf[tau] >= clarityThreshold) {
      // If the true fundamental period is below minLag, pitch is above maxFreq
      if (tau < minLag) {
        return { pitch: 0, clarity: Math.max(0, nsdf[tau]), voiced: false };
      }
      bestLag = tau;
      bestVal = nsdf[tau];
      break;
    }
  }

  // If no peak passed the threshold in the vocal range, find highest peak in [minLag, maxLag]
  if (bestLag === -1) {
    for (let tau = minLag + 1; tau <= maxLag; tau += 1) {
      if (nsdf[tau] > nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1] && nsdf[tau] > bestVal) {
        bestLag = tau;
        bestVal = nsdf[tau];
      }
    }
  }

  if (bestLag === -1 || bestVal < clarityThreshold) {
    return { pitch: 0, clarity: Math.max(0, bestVal), voiced: false };
  }

  // 4. Parabolic interpolation for sub-sample lag refinement
  const alpha = nsdf[bestLag - 1];
  const beta = nsdf[bestLag];
  const gamma = nsdf[bestLag + 1];
  const denominator = 2 * (alpha - 2 * beta + gamma);
  const delta = Math.abs(denominator) > 1e-6 ? (alpha - gamma) / denominator : 0;
  const refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, delta));

  const pitch = sampleRate / refinedLag;
  return {
    pitch: pitch >= minFreq && pitch <= maxFreq ? pitch : 0,
    clarity: Math.max(0, Math.min(1, beta)),
    voiced: pitch >= minFreq && pitch <= maxFreq,
  };
}

/**
 * Extracts pitch contour across an audio buffer using sliding window frames.
 */
export function extractPitchContour(audioData, sampleRate, { frameSize = 2048, hopSize = 512, ...options } = {}) {
  if (!audioData || audioData.length < frameSize || sampleRate <= 0) {
    return [];
  }

  const frames = [];
  const totalFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;

  for (let i = 0; i < totalFrames; i += 1) {
    const start = i * hopSize;
    const windowSlice = audioData.subarray ? audioData.subarray(start, start + frameSize) : audioData.slice(start, start + frameSize);
    const time = (start + frameSize / 2) / sampleRate;
    const result = detectPitch(windowSlice, sampleRate, options);

    frames.push({
      time,
      pitch: result.pitch,
      clarity: result.clarity,
      voiced: result.voiced,
    });
  }

  // Apply a 3-point median filter to voiced frames to suppress spurious octave jumps
  for (let i = 1; i < frames.length - 1; i += 1) {
    if (frames[i - 1].voiced && frames[i].voiced && frames[i + 1].voiced) {
      const trio = [frames[i - 1].pitch, frames[i].pitch, frames[i + 1].pitch].sort((a, b) => a - b);
      frames[i].pitch = trio[1];
    }
  }

  return frames;
}

/**
 * Segments the voiced portion of a pitch contour into N mora segments.
 */
export function segmentMorae(frames, moraCount) {
  if (!frames || !frames.length || moraCount <= 0) {
    return [];
  }

  // Find first and last voiced frames
  const firstVoicedIndex = frames.findIndex((f) => f.voiced);
  if (firstVoicedIndex === -1) {
    // Completely unvoiced
    return Array.from({ length: moraCount }, (_, index) => ({
      moraIndex: index,
      startTime: 0,
      endTime: 0,
      pitch: 0,
      voiced: false,
      frameCount: 0,
    }));
  }

  let lastVoicedIndex = frames.length - 1;
  while (lastVoicedIndex >= 0 && !frames[lastVoicedIndex].voiced) {
    lastVoicedIndex -= 1;
  }

  const startTime = frames[firstVoicedIndex].time;
  const endTime = frames[lastVoicedIndex].time;
  const duration = Math.max(0.1, endTime - startTime);
  const moraDuration = duration / moraCount;

  const moraSegments = [];
  for (let i = 0; i < moraCount; i += 1) {
    const mStart = startTime + i * moraDuration;
    const mEnd = startTime + (i + 1) * moraDuration;

    // Collect frames within this mora window
    const moraFrames = frames.filter((f) => f.time >= mStart && f.time < mEnd);
    const voicedPitches = moraFrames.filter((f) => f.voiced && f.pitch > 0).map((f) => f.pitch);

    const pitch = voicedPitches.length ? median(voicedPitches) : 0;
    moraSegments.push({
      moraIndex: i,
      startTime: mStart,
      endTime: mEnd,
      pitch,
      voiced: voicedPitches.length > 0,
      frameCount: voicedPitches.length,
    });
  }

  return moraSegments;
}

/**
 * Compares learner's segmented mora pitch with the target High/Low pattern.
 * Provides per-mora correctness, pitch deltas, and percentage score.
 */
export function scoreMoraPitch(moraSegments, targetPattern) {
  if (!moraSegments?.length || !targetPattern?.length) {
    return {
      score: null,
      passed: false,
      moraResults: [],
      feedback: 'No pitch target or audio available for comparison.',
    };
  }

  const count = Math.min(moraSegments.length, targetPattern.length);
  const voicedPitches = moraSegments.slice(0, count).filter((m) => m.voiced && m.pitch > 0).map((m) => m.pitch);

  if (voicedPitches.length < Math.max(1, Math.floor(count / 2))) {
    return {
      score: 0,
      passed: false,
      moraResults: moraSegments.slice(0, count).map((m, idx) => ({
        moraIndex: idx,
        expected: targetPattern[idx] || 'L',
        actual: 'unvoiced',
        match: false,
        pitch: m.pitch,
      })),
      feedback: 'Speak a bit louder or closer to the microphone.',
    };
  }

  // Find median utterance pitch
  const baselinePitch = median(voicedPitches);

  // If the target has both H and L, determine H/L pitch threshold
  const hasHigh = targetPattern.slice(0, count).includes('H');
  const hasLow = targetPattern.slice(0, count).includes('L');

  let threshold = baselinePitch;
  if (hasHigh && hasLow) {
    const minP = Math.min(...voicedPitches);
    const maxP = Math.max(...voicedPitches);
    // Dynamic midpoint between lowest and highest voiced mora
    threshold = (minP + maxP) / 2;
  }

  let correctCount = 0;
  const moraResults = [];

  for (let i = 0; i < count; i += 1) {
    const segment = moraSegments[i];
    const expected = targetPattern[i] || 'L';

    if (!segment.voiced || segment.pitch <= 0) {
      moraResults.push({
        moraIndex: i,
        expected,
        actual: 'unvoiced',
        match: false,
        pitch: 0,
      });
      continue;
    }

    // Relative classification: High vs Low
    // For single-mora words or all-H / all-L words, pitch is considered matched if voiced
    let actual = 'L';
    if (!hasLow) {
      actual = 'H';
    } else if (!hasHigh) {
      actual = 'L';
    } else {
      actual = segment.pitch >= threshold ? 'H' : 'L';
    }

    // Check transition rules if available:
    // If expected is H drop to L at mora i -> i+1, check if pitch actually decreased
    let match = actual === expected;

    // Transition sensitivity bonus: if previous mora was H and this is L, verify drop
    if (i > 0 && moraSegments[i - 1].voiced) {
      const prevExpected = targetPattern[i - 1];
      const prevPitch = moraSegments[i - 1].pitch;
      if (prevExpected === 'H' && expected === 'L') {
        // Did pitch drop?
        match = segment.pitch < prevPitch;
        actual = match ? 'L' : 'H';
      } else if (prevExpected === 'L' && expected === 'H') {
        // Did pitch rise?
        match = segment.pitch > prevPitch;
        actual = match ? 'H' : 'L';
      }
    }

    if (match) correctCount += 1;

    moraResults.push({
      moraIndex: i,
      expected,
      actual,
      match,
      pitch: Math.round(segment.pitch),
    });
  }

  const score = Math.round((correctCount / count) * 100);
  const passed = score >= 70;

  let feedback = 'Excellent! Your pitch matched the standard accent.';
  if (score === 100) {
    feedback = 'Perfect pitch! All morae match standard Tokyo accent.';
  } else if (score >= 70) {
    feedback = 'Good pitch contour! Check the highlighted mora for small adjustments.';
  } else if (!passed) {
    const firstMiss = moraResults.find((m) => !m.match);
    if (firstMiss) {
      feedback = `Mora ${firstMiss.moraIndex + 1} was pronounced ${firstMiss.actual === 'H' ? 'high' : 'low'}, but should be ${firstMiss.expected === 'H' ? 'high' : 'low'}.`;
    } else {
      feedback = 'Listen to the reference clip and try to match the high/low steps.';
    }
  }

  return {
    score,
    passed,
    moraResults,
    feedback,
  };
}
