const feature = document.querySelector('.css-in-action');
if (feature) {
  const container = feature.querySelector('.css-in-action-container');
  const slider = feature.querySelector('input[type="range"]');
  const readout = feature.querySelector('.css-in-action-readout');
  const measure = () => {
    const pixels = container.getBoundingClientRect().width;
    const rem = pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
    const value = `${Number(rem.toFixed(2))}rem (${Math.round(pixels)}px)`;
    readout.textContent = value;
    slider.setAttribute('aria-valuetext', `${slider.value}rem requested; ${value} available`);
  };
  const resize = () => {
    container.style.inlineSize = `${slider.value}rem`;
    measure();
  };
  feature.querySelector('.css-in-action-controls').hidden = false;
  slider.addEventListener('input', resize);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(container);
  else addEventListener('resize', measure);
  resize();

  const copy = feature.querySelector('.css-in-action-copy');
  const feedback = feature.querySelector('[role="status"]');
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    feedback.textContent = '';
    try {
      await navigator.clipboard.writeText(feature.querySelector('pre').textContent);
      feedback.textContent = 'CSS copied.';
    } catch {
      feedback.textContent = 'Could not copy. Select the CSS to copy it manually.';
    }
  });
}
