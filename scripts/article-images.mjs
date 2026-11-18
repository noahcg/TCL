import { open, readFile, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadContent, assert } from '../src/build/content.mjs';
import { imageIsCurrent, imagePrompt, mediaCatalogFile, readMediaCatalog, saveArticleImage, validateArticleImage } from '../src/build/article-media.mjs';
import { generateArticleImage } from '../src/build/image-generation.mjs';

const { values } = parseArgs({ options: {
  plan: { type: 'boolean' }, force: { type: 'boolean' }, import: { type: 'boolean' },
  slug: { type: 'string' }, file: { type: 'string' }, alt: { type: 'string' },
  'prompt-file': { type: 'string' },
} });
const articles = (await loadContent()).filter(entry => entry.type === 'article' && (!values.slug || entry.slug === values.slug));
assert(articles.length, 'No matching published article. Check --slug.');
assert(!values.import || (values.slug && values.file && !values.plan), 'Import requires --slug and --file');
assert(!values.file || values.import, '--file is only supported with --import');
assert(!values['prompt-file'] || values.import, '--prompt-file is only supported with --import');
const catalog = await readMediaCatalog();

if (values.plan) {
  console.log(JSON.stringify(articles.map(article => ({
    slug: article.slug, title: article.title, status: imageIsCurrent(article, catalog.images[article.slug]) ? 'ready' : 'needs-image',
    prompt: imagePrompt(article),
  })), null, 2));
} else {
  const lockFile = new URL('.article-images.lock', mediaCatalogFile);
  const lock = await open(lockFile, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw new Error('Another image publishing process holds the catalog lock.');
    throw error;
  });
  try {
    for (const article of articles) {
      if (!values.force && !values.import && imageIsCurrent(article, catalog.images[article.slug])) {
        await validateArticleImage(article, catalog.images[article.slug]);
        console.log(`Cached: ${article.slug}`);
        continue;
      }
      let data;
      let generatedBy;
      if (values.import) {
        data = await readFile(values.file);
        generatedBy = 'chatgpt-imagegen';
      } else {
        const model = process.env.TCL_IMAGE_MODEL || 'gpt-image-2';
        console.log(`Generating: ${article.slug}`);
        data = await generateArticleImage(article, { apiKey: process.env.OPENAI_API_KEY, model });
        generatedBy = `openai:${model}`;
      }
      const prompt = values['prompt-file'] ? await readFile(values['prompt-file'], 'utf8') : imagePrompt(article);
      const image = await saveArticleImage(article, data, { catalog, generatedBy, alt: values.alt, prompt });
      console.log(`Saved: ${image.path}`);
    }
  } finally {
    await lock.close();
    await rm(lockFile, { force: true });
  }
}
