# Authoring and publishing

Create one UTF-8 JSON file per item in `content/authored/`. The filename is for review, and `slug` defines the public URL. Start as `draft` and change to `published` once editorial review is complete. Accepted statuses are `draft`, `published` and `archived`.

```json
{
  "type": "article",
  "slug": "<choose-a-stable-slug>",
  "status": "draft",
  "title": "<author-supplied title>",
  "summary": "<author-supplied summary>",
  "format": "markdown",
  "body": "<author-supplied Markdown>"
}
```

The angle brackets are fields to replace. The example belongs in this guide. It should never enter the content collection as a record.

- Use `article`, `quick-win`, or `resource` as `type`. Slugs are lowercase letters and digits with single separating hyphens. Keep them stable after publication.
- Body formats are `markdown`, `html`, and `text`. For Markdown, begin body sections at H2 and fence snippets with the correct language. For HTML, keep headings, lists and tables semantic and give meaningful images descriptive alt text. Use stable IDs for links that must follow a section through a rename.
- Add `date` as `YYYY-MM-DD`, `updatedAt` as an ISO timestamp, `author`, `attribution`, `tags` as an array, and `source` as an HTTPS link when supported by the source. An unknown field can be omitted. Authored metadata must be accurate.
- Quick Wins can set `difficulty`, `code` and `note` for their listing. Include the same snippet in the detail body. Resources require a vetted HTTPS `url` and can use `kind` set to `Person` or `Reference`.
- Use plain text for metadata. Active HTML features need a reviewed first-party component. Imported code stays readable and copyable as text. The original example and code source are kept in the source snapshot where applicable.

Open a pull request with the source, preview and accessibility checks. Use `npm run content:verify`, `npm test`, and `npm run build` locally. Accept the changes after verifying the detail route, heading links, source credit and search result. For migrated records, update through the [migration workflow](apex-migration.md).

## Article images and featuring

Every published article requires a unique hero/share image. Run `npm run content:prepare` to generate missing or changed title-based artwork once `OPENAI_API_KEY` is configured privately, or import artwork generated with Codex’s imagegen tool. Commit the image and catalog alongside the content. See [article artwork](article-images.md) for prompts, caching, alt text, and social previews.

Choose the featured article in `content/editorial.json`, or set `"featured": true` on one authored published article. Its own image is automatically used in the archive feature and default site sharing card.
