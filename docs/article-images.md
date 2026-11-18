# Article artwork and sharing cards

Every published article has its own AI-generated image based on its title, summary, and CSS topic. The same optimized 1200 × 630 JPEG is used for the article hero, its featured archive thumbnail when selected, and its Open Graph/X large-image sharing card. The initial 15 images were generated with ChatGPT’s built-in imagegen tool.

## Files

- `content/media/image-briefs.json`: optional per-article art direction; new titles work without a custom brief.
- `content/media/article-images.json`: image catalog, source fingerprints, checksums, alt text, provenance, and exact prompts.
- `src/assets/articles/`: optimized, versioned image files committed alongside content.
- `content/editorial.json`: the featured article slug; change it to any published article without editing the sealed import snapshot.

The existing container-query feature remains selected. An authored article can alternatively set `"featured": true`; only one published article may set it. All articles have images, so promoting another article selects its own artwork automatically.

## Publish a new article

Create the article record using the [authoring guide](authoring.md), then inspect the image plan:

```sh
npm run images:plan
npm run images:plan -- --slug your-article-slug
```

To enable API generation, create an OpenAI API key in your OpenAI account and set `OPENAI_API_KEY` privately in `.env.local` or your shell. The image generation command loads `.env.local`; ordinary builds do not. Never commit the key, paste it into chat, or expose it through a browser environment variable. API generation uses the account’s API billing.

```sh
npm run content:prepare
```

This generates missing or stale article artwork, validates cached files, and runs the regular content/unit/build checks. Generation uses the Images API with `gpt-image-2`, high quality, and a landscape composition. Set `TCL_IMAGE_MODEL` only when deliberately changing the model. Existing current images are reused without API calls. Title, summary, art brief, or prompt-template changes invalidate the affected cache entry.

Review the artwork and its alt text, then commit the article, catalog, and new JPEG together. Run `npm run test:browser`, then push to both configured remotes as described in [deployment](deployment.md). Vercel builds serve committed images and require no image-generation secret or network call to OpenAI.

To regenerate one image deliberately:

```sh
npm run images:generate -- --slug your-article-slug --force
```

Generation is a publishing step. A build fails with an actionable message when a published article has missing, stale, duplicate, or corrupt artwork. This prevents accidentally publishing an article with another article’s image. Failed requests preserve existing files; rerunning continues from completed cache entries.

## Import artwork generated in ChatGPT

When working in Codex without an API key, use its built-in imagegen tool with the prompt from `images:plan`, then import the saved image:

```sh
npm run images:import -- --slug your-article-slug --file /absolute/path/to/generated-image.png
```

The source must be at least 1200 × 630. The importer optimizes the JPEG, creates a content-hashed filename, and records it in the catalog. Supply `--alt "Description of the artwork"` to override the title-based alternative text. For a deliberately customized generation prompt, preserve it in a local text file and pass `--prompt-file /absolute/path/to/prompt.txt` during import. The initial prompt set is retained in the catalog.

## Social previews

Production HTML includes absolute HTTPS `og:image` and `twitter:image` URLs, image dimensions, MIME type, alt text, article type/date metadata, and `summary_large_image`. The homepage and collection pages use the currently featured article’s artwork as their default social image. Local/no-origin previews omit image sharing tags; test them with a production build using the intended site origin.

Images are public static JPEGs, so crawlers can fetch them without JavaScript or authentication. Updating artwork changes its content-hashed URL, helping platforms discover the new image. Social networks maintain their own preview caches; existing shared links may need a fresh scrape before their thumbnail changes.
