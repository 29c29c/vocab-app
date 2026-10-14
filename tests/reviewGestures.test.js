import test from 'node:test';
import assert from 'node:assert/strict';
import { getReviewGesture } from '../src/client/reviewGestures.js';

test('short touches and vertical scrolling cannot grade a vocabulary card', () => {
    for (const movement of [{ deltaX: 0, deltaY: 0 }, { deltaX: 90, deltaY: 2 }, { deltaX: -50, deltaY: 8 }, { deltaX: 130, deltaY: 160 }, { deltaX: -150, deltaY: -100 }]) {
        assert.equal(getReviewGesture({ ...movement, isRevealed: true }), null);
    }
});
test('swiping a question reveals the answer before any score can be submitted', () => {
    for (const deltaX of [-140, 140]) assert.equal(getReviewGesture({ deltaX, deltaY: 10, isRevealed: false }), 'reveal');
});
test('deliberate horizontal swipes grade only revealed answers', () => {
    assert.equal(getReviewGesture({ deltaX: 150, deltaY: 20, isRevealed: true }), 'easy');
    assert.equal(getReviewGesture({ deltaX: -150, deltaY: -20, isRevealed: true }), 'forget');
});
