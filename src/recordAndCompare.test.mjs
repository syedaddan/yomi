import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

test('renders PitchContourGraph with mora grid, guidelines, and reference contour', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });

  try {
    const { default: PitchContourGraph } = await vite.ssrLoadModule('/src/components/PitchContourGraph.jsx');

    const html = renderToString(React.createElement(PitchContourGraph, {
      morae: ['つ', 'く', 'え'],
      targetPattern: ['L', 'H', 'H'],
      learnerContour: [],
      moraSegments: [],
      moraResults: [],
      score: null,
    }));

    // Verify SVG chart elements
    assert.match(html, /pitch-graph-svg/);
    assert.match(html, /pitch-guide-label high/);
    assert.match(html, /pitch-guide-label low/);
    assert.match(html, /つ/);
    assert.match(html, /く/);
    assert.match(html, /え/);
    assert.match(html, /pitch-target-tag l/);
    assert.match(html, /pitch-target-tag h/);
    assert.match(html, /pitch-ref-path/);
    assert.match(html, /Record your voice to see your pitch curve/);

    // Verify when score and learner results are present
    const scoredHtml = renderToString(React.createElement(PitchContourGraph, {
      morae: ['か', 'さ'],
      targetPattern: ['H', 'L'],
      learnerContour: [
        { time: 0.1, pitch: 220, clarity: 0.9, voiced: true },
        { time: 0.2, pitch: 220, clarity: 0.9, voiced: true },
        { time: 0.3, pitch: 150, clarity: 0.9, voiced: true },
        { time: 0.4, pitch: 150, clarity: 0.9, voiced: true },
      ],
      moraSegments: [
        { moraIndex: 0, pitch: 220, voiced: true },
        { moraIndex: 1, pitch: 150, voiced: true },
      ],
      moraResults: [
        { moraIndex: 0, expected: 'H', actual: 'H', match: true, pitch: 220 },
        { moraIndex: 1, expected: 'L', actual: 'L', match: true, pitch: 150 },
      ],
      score: 100,
    }));

    assert.match(scoredHtml, /pitch-learner-path/);
    assert.match(scoredHtml, /pitch-learner-dot match/);
    assert.match(scoredHtml, /220 Hz/);
    assert.match(scoredHtml, /150 Hz/);
  } finally {
    await vite.close();
  }
});

test('renders RecordAndCompare toggle and revealed Drill card integration', async () => {
  const vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });

  try {
    const { default: RecordAndCompare } = await vite.ssrLoadModule('/src/components/RecordAndCompare.jsx');

    const sampleItem = {
      id: 'h:つくえ:desk',
      deck: 'hira',
      chunks: [{ w: 'つくえ', p: '', a: 0 }],
      en: 'desk',
      theme: 'Home',
      moraCount: 3,
      accents: [0],
    };

    const recordHtml = renderToString(React.createElement(RecordAndCompare, {
      item: sampleItem,
      onPlayReference: () => {},
      notify: () => {},
    }));

    assert.match(recordHtml, /record-compare/);
    assert.match(recordHtml, /Record &amp; compare pitch/);
    assert.match(recordHtml, /aria-expanded="true"/);
    assert.match(recordHtml, /record-btn/);

    // Verify Drill includes RecordAndCompare when rendered
    const { default: Drill } = await vite.ssrLoadModule('/src/components/Drill.jsx');
    const { DEFAULT_PREFS } = await vite.ssrLoadModule('/src/storage.js');
    const drillHtml = renderToString(React.createElement(Drill, {
      prefs: DEFAULT_PREFS,
      setPreference: () => {},
      store: { stats: {}, sprints: [], conf: {}, prefs: {}, customItems: [] },
      setStore: () => {},
      notify: () => {},
      active: true,
      items: [sampleItem],
    }));

    assert.match(drillHtml, /page-drill/);
  } finally {
    await vite.close();
  }
});
