import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickDetails, toItem, transcriptRequest, videoRequest } from '../src/transform.js';

test('requests', () => {
    assert.deepEqual(transcriptRequest('jNQXAC9IVRw', { lang: null, cacheDays: 0 }), { path: '/v1/youtube/transcript', body: { url: 'jNQXAC9IVRw' } });
    assert.deepEqual(transcriptRequest('x', { lang: 'de', cacheDays: 7 }).body, { url: 'x', lang: 'de', cache_days: 7 });
    assert.equal(videoRequest('x', { cacheDays: 0 }).path, '/v1/youtube/video');
});

test('toItem counts words and toggles segments', () => {
    const transcript = { video_id: 'v', text: 'one two  three', segments: [{ start: 0, text: 'one two three' }] };
    const withSeg = toItem('v', transcript, { title: 'T', view_count: 3 }, { includeSegments: true }, 2);
    assert.equal(withSeg.word_count, 3);
    assert.equal(withSeg.segments.length, 1);
    assert.equal(withSeg.title, 'T');
    const noSeg = toItem('v', transcript, null, { includeSegments: false }, 1);
    assert.equal(noSeg.segments, undefined);
    assert.equal(noSeg.title, undefined);
    assert.deepEqual(pickDetails(null), {});
});
