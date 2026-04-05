export function normalizePositions(nodesList) {
  if (!Array.isArray(nodesList) || !nodesList.length) return nodesList ?? [];
  const cleaned = nodesList.map((n) => {
    const x = Number(n.position?.x ?? 0);
    const y = Number(n.position?.y ?? 0);
    const bad = !Number.isFinite(x) || !Number.isFinite(y);
    const tooFar = Math.abs(x) > 2000 || Math.abs(y) > 2000;
    if (bad || tooFar) {
      return { ...n, position: { x: 200, y: 200 } };
    }
    return n;
  });

  const xs = cleaned.map((n) => n.position.x);
  const ys = cleaned.map((n) => n.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  const needsShift =
    span > 2000 || Math.abs(minX) > 1500 || Math.abs(minY) > 1500;
  if (!needsShift) return cleaned;

  const shiftX = 200 - minX;
  const shiftY = 200 - minY;
  return cleaned.map((n) => ({
    ...n,
    position: {
      x: n.position.x + shiftX,
      y: n.position.y + shiftY,
    },
  }));
}
