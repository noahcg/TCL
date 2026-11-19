const feature = document.querySelector('.css-in-action');
if (feature) {
  const container = feature.querySelector('.css-in-action-container');
  const slider = feature.querySelector('input[type="range"]');
  const readout = feature.querySelector('.css-in-action-readout');
  if (container && slider) {
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
  }

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

for (const demo of document.querySelectorAll('[data-article-demo]')) {
  for (const controls of demo.querySelectorAll('[data-ad-enhancement]')) controls.hidden = false;
  for (const note of demo.querySelectorAll('[data-ad-support]')) if (CSS.supports(note.dataset.adSupport)) note.hidden = true;
  for (const button of demo.querySelectorAll('[data-ad-action]')) button.hidden = false;
  const mix = demo.querySelector('[data-ad-property]');
  mix?.addEventListener('input', () => {
    demo.style.setProperty(mix.dataset.adProperty, mix.value + mix.dataset.adUnit);
    demo.querySelector('output').textContent = mix.value + mix.dataset.adUnit;
  });
  const imageChoice = demo.querySelector('#ad-include-image');
  const image = demo.querySelector('.ad-selector-card img');
  imageChoice?.addEventListener('change', () => {
    if (imageChoice.checked) demo.querySelector('.ad-selector-card').prepend(image);
    else image.remove();
  });
  demo.addEventListener('click', event => {
    const button = event.target.closest('[data-ad-action]');
    if (!button) return;
    const action = button.dataset.adAction;
    if (action === 'page') {
      const update = () => {
        const reading = demo.dataset.reading !== 'true';
        demo.dataset.reading = String(reading);
        demo.querySelector('.ad-page-caption').textContent = reading ? 'The reading view' : 'The collection';
        demo.querySelector('.ad-page-description').textContent = reading ? 'Settle into the full story. The same title connects these two views.' : 'An invitation to read something new.';
        button.textContent = reading ? 'Back to collection' : 'Open reading view';
      };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update);
      else update();
    }
    if (action === 'batch') {
      const list = demo.querySelector('.ad-notes');
      const count = list.children.length === 7 ? 40 : 7;
      list.replaceChildren(...Array.from({ length: count }, (_, index) => {
        const li = document.createElement('li'); li.textContent = `Reading note ${index + 1}: a good idea is ready.`; return li;
      }));
      button.textContent = count === 7 ? 'Show forty notes' : 'Show seven notes';
    }
    if (action === 'replay' || action === 'batch') {
      const list = demo.querySelector('.ad-notes');
      list.classList.remove('ad-replay');
      void list.offsetWidth;
      list.classList.add('ad-replay');
    }
  });
}
