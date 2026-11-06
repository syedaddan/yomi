import React from 'react';

/**
 * Visual SVG Pitch Contour Graph comparing target pitch accent against learner voice.
 */
export default function PitchContourGraph({
  morae = [],
  targetPattern = [],
  learnerContour = [],
  moraSegments = [],
  moraResults = [],
  score = null,
}) {
  const width = 540;
  const height = 220;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 46;
  const padBottom = 42;
  const usableWidth = width - padLeft - padRight;
  const usableHeight = height - padTop - padBottom;

  const yHigh = padTop + 24;
  const yLow = padTop + usableHeight - 20;
  const moraCount = Math.max(1, morae.length);
  const colWidth = usableWidth / moraCount;

  // 1. Reference target points
  const refMoraPoints = morae.map((_, i) => {
    const xCenter = padLeft + (i + 0.5) * colWidth;
    const target = targetPattern[i] || 'L';
    const y = target === 'H' ? yHigh : yLow;
    return { x: xCenter, y, target };
  });

  // Create stepped reference path
  let refPath = '';
  if (refMoraPoints.length) {
    refPath = `M ${padLeft} ${refMoraPoints[0].y}`;
    for (let i = 0; i < moraCount; i += 1) {
      const xStart = padLeft + i * colWidth;
      const xEnd = padLeft + (i + 1) * colWidth;
      const y = refMoraPoints[i].y;
      refPath += ` L ${xStart} ${y} L ${xEnd} ${y}`;
    }
  }

  // 2. Learner Contour Path
  const voicedFrames = (learnerContour || []).filter((f) => f.voiced && f.pitch > 0);
  let learnerPath = '';
  const learnerPoints = [];

  if (voicedFrames.length >= 2) {
    const tMin = voicedFrames[0].time;
    const tMax = voicedFrames[voicedFrames.length - 1].time;
    const tDuration = Math.max(0.1, tMax - tMin);

    const pitches = voicedFrames.map((f) => f.pitch);
    const pMin = Math.min(...pitches);
    const pMax = Math.max(...pitches);
    const pRange = Math.max(30, pMax - pMin);

    learnerPath = voicedFrames.map((f, idx) => {
      const relTime = (f.time - tMin) / tDuration;
      const x = padLeft + 8 + relTime * (usableWidth - 16);
      const relPitch = (f.pitch - pMin) / pRange;
      // Invert: high pitch has lower y
      const y = yLow - relPitch * (yLow - yHigh);
      const clampedY = Math.max(padTop + 4, Math.min(height - padBottom - 4, y));
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${clampedY.toFixed(1)}`;
    }).join(' ');

    // Learner mora median points
    moraSegments.forEach((seg, i) => {
      if (seg.voiced && seg.pitch > 0) {
        const xCenter = padLeft + (i + 0.5) * colWidth;
        const relPitch = (seg.pitch - pMin) / pRange;
        const y = yLow - relPitch * (yLow - yHigh);
        const clampedY = Math.max(padTop + 4, Math.min(height - padBottom - 4, y));
        const res = moraResults[i];
        learnerPoints.push({
          x: xCenter,
          y: clampedY,
          pitch: Math.round(seg.pitch),
          match: res ? res.match : true,
          moraIndex: i,
        });
      }
    });
  }

  return (
    <div className="pitch-graph-wrap">
      <svg
        className="pitch-graph-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Pitch contour comparison chart. Target pitch accent with ${moraCount} morae.`}
      >
        <defs>
          <linearGradient id="learnerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--accent, #0284c7)" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {/* High / Low Pitch Tier Horizontal Guidelines */}
        <line
          x1={padLeft - 6}
          y1={yHigh}
          x2={width - padRight}
          y2={yHigh}
          className="pitch-guide-line high"
        />
        <text x={padLeft - 12} y={yHigh + 4} className="pitch-guide-label high">High</text>

        <line
          x1={padLeft - 6}
          y1={yLow}
          x2={width - padRight}
          y2={yLow}
          className="pitch-guide-line low"
        />
        <text x={padLeft - 12} y={yLow + 4} className="pitch-guide-label low">Low</text>

        {/* Mora Columns & Dividers */}
        {morae.map((mora, i) => {
          const xStart = padLeft + i * colWidth;
          const xCenter = xStart + colWidth / 2;
          const target = targetPattern[i] || 'L';
          const res = moraResults[i];
          const isDrop = target === 'H' && targetPattern[i + 1] === 'L';

          return (
            <g key={`mora-col-${mora}-${i}`}>
              {i > 0 && (
                <line
                  x1={xStart}
                  y1={padTop - 8}
                  x2={xStart}
                  y2={height - padBottom + 12}
                  className="pitch-mora-divider"
                />
              )}
              {/* Mora Character Label */}
              <text x={xCenter} y={24} className="pitch-mora-label">
                {mora}
              </text>
              {/* Target Pitch Badge */}
              <text x={xCenter} y={38} className={`pitch-target-tag ${target.toLowerCase()}`}>
                {target}{isDrop ? '↘' : ''}
              </text>

              {/* Mora Result indicator chip */}
              {res && (
                <text
                  x={xCenter}
                  y={height - 12}
                  className={`pitch-res-chip ${res.actual === 'unvoiced' ? 'unvoiced' : res.match ? 'match' : 'mismatch'}`}
                >
                  {res.actual === 'unvoiced' ? '–' : res.match ? `✓ ${res.actual}` : `✗ ${res.actual}`}
                </text>
              )}
            </g>
          );
        })}

        {/* Reference Target Contour Line */}
        {refPath && (
          <path
            d={refPath}
            className="pitch-ref-path"
            fill="none"
          />
        )}

        {/* Reference dots at each mora */}
        {refMoraPoints.map((pt, i) => (
          <circle
            key={`ref-dot-${i}`}
            cx={pt.x}
            cy={pt.y}
            r="4.5"
            className={`pitch-ref-dot ${pt.target.toLowerCase()}`}
          />
        ))}

        {/* Learner Pitch Curve */}
        {learnerPath && (
          <path
            d={learnerPath}
            className="pitch-learner-path"
            fill="none"
          />
        )}

        {/* Learner Mora Median Dots */}
        {learnerPoints.map((pt, i) => (
          <g key={`learner-dot-${i}`}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="6"
              className={`pitch-learner-dot ${pt.match ? 'match' : 'mismatch'}`}
            />
            <text x={pt.x} y={pt.y - 10} className="pitch-hz-label">
              {`${pt.pitch} Hz`}
            </text>
          </g>
        ))}

        {/* Prompt when idle and no recording has taken place */}
        {!learnerPath && (
          <text
            x={padLeft + usableWidth / 2}
            y={padTop + usableHeight / 2 + 5}
            className="pitch-empty-prompt"
            textAnchor="middle"
          >
            Record your voice to see your pitch curve overlaid on the reference.
          </text>
        )}
      </svg>
    </div>
  );
}
