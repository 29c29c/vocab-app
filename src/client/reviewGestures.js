// Horizontal intent must be clear enough to distinguish it from scrolling.
export function getReviewGesture({ deltaX, deltaY, isRevealed }) {
    if (Math.abs(deltaX) <= 90 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.6) return null;
    if (!isRevealed) return 'reveal';
    return deltaX > 0 ? 'easy' : 'forget';
}
