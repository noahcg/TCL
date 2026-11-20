export function makePalette(hue) {
  if (!Number.isFinite(hue)) {
    throw new TypeError("Hue must be a finite number.");
  }

  const angle = ((hue % 360) + 360) % 360;
  return [86, 64, 38].map(lightness =>
    `hsl(${angle} 40% ${lightness}%)`
  );
}
