# Homepage lounge artwork

`src/assets/lounge-reading-nook.webp` is the editorial image used by the homepage's “A Closer Look” container-query demo. It was generated with the built-in imagegen tool, then resized to 1440 × 960 and encoded as WebP with the repository's existing Sharp dependency. The site serves the local asset; it makes no image-generation requests at runtime.

The direction emphasizes an inviting lounge interior, materials and warm light. It complements the homepage scene without adding music or performance imagery. To replace it, update the image reference and alternative text in `src/build/css-in-action.mjs`.

## Generation prompt

> Use case: photorealistic-natural
> Asset type: editorial image for The Cascade Lounge's interactive CSS demo card
> Primary request: An exquisitely composed, inviting 1960s-inspired lounge reading nook, emphasizing the atmosphere and interior design of a jazz lounge, not music or performance.
> Scene: A sculptural caramel velvet lounge chair beside a small round walnut table with a ceramic espresso cup and an open design book. A glowing amber glass table lamp casts a beautiful pool of light across the wall and table. Deep olive-green plaster walls, subtle walnut paneling, a leafy plant, a softly lit arched doorway in the background. Tasteful abstract geometric art in a thin brass frame.
> Style: High-end architectural editorial photography, tactile and believable, sophisticated and warmly cinematic. Crisp real material details, restrained film grain.
> Composition: Landscape 3:2 image. The chair, lamp, and table form a coherent arrangement across the central two-thirds so the image crops elegantly into a vertical portrait. Let the interior fill the image; no reserved text area. Eye-level viewpoint, architectural proportions, intimate but spacious.
> Lighting: Rich dusk light, golden lamp glow balanced with soft green shadows, luminous highlights, dimensional rather than muddy or overly dark.
> Palette: deep forest and olive green, cognac/caramel upholstery, walnut brown, warm amber, touches of ivory and aged brass.
> Constraints: No people, no text, no logos, no watermarks, no instruments, no records or record players, no stage, no microphones, no music notes. This is a lounge to settle into with a good idea.
