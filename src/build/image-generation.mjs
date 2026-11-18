import { assert } from './content.mjs';
import { imagePrompt } from './article-media.mjs';

export async function generateArticleImage(article, { apiKey, model = 'gpt-image-2', fetcher = fetch } = {}) {
  assert(apiKey, 'Missing OPENAI_API_KEY. Set it privately in .env.local or your shell, then run npm run images:generate. Never put it in browser code or Git.');
  const response = await fetcher('https://api.openai.com/v1/images/generations', {
    method: 'POST', signal: AbortSignal.timeout(300_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: imagePrompt(article), n: 1, size: '1536x1024', quality: 'high', output_format: 'jpeg' }),
  });
  // Do not print response bodies: provider errors can repeat request data.
  // Paid image requests are deliberately not retried automatically.
  if (!response.ok) throw new Error(`Image generation failed for ${article.slug} (HTTP ${response.status}). No existing image was replaced. Check API access and billing before retrying.`);
  const payload = await response.json();
  const base64 = payload.data?.[0]?.b64_json;
  assert(typeof base64 === 'string' && base64.length && /^[A-Za-z0-9+/]+={0,2}$/.test(base64), `${article.slug}: image API returned no valid image bytes`);
  return Buffer.from(base64, 'base64');
}
