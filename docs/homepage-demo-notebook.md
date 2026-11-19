# A Closer Look: playable article demos

All 16 published articles have an executable example. Open **Article demos** in Editorial Studio to preview, use now, or choose a month. The scheduler is described in [Scheduling A Closer Look](homepage-rotation.md).

## Scrolling Gets Smarter with Markers, Buttons, and Scroll State

- Demo: scroll-state
- Interaction: Scroll the reading panel. Its heading stays nearby; supported browsers label it when stuck.
- Article: [Scrolling Gets Smarter with Markers, Buttons, and Scroll State](/articles/scroll-state/)
- Support/fallback: Sticky headings and native scrolling still work here. This browser does not support the extra scroll-state label.

## Understanding CSS Specificity (Without the Headaches)

- Demo: specificity
- Interaction: Enable a class rule, an ID rule, or both. The stronger selector determines the invitation’s border and message.
- Article: [Understanding CSS Specificity (Without the Headaches)](/articles/specificity/)

## Responsive Components with CSS Style Queries

- Demo: style-queries
- Interaction: Choose a warm context. A custom property carries that context to the nested invitation.
- Article: [Responsive Components with CSS Style Queries](/articles/style-queries/)
- Support/fallback: The base invitation stays readable. Style-query support varies independently of size queries; compare the two states in your target browser.

## Positioning UI the Native Way with Popovers and Anchors

- Demo: popovers-anchors
- Interaction: Open the reading note. Click outside or press Escape to dismiss the native popover.
- Article: [Positioning UI the Native Way with Popovers and Anchors](/articles/popovers-anchors/)
- Support/fallback: The native popover uses its default placement when anchor positioning is unavailable. Browsers without popovers show the note in normal flow.

## Smoother Navigation with CSS Page Transitions

- Demo: page-transitions
- Interaction: Switch between the collection and reading views. View Transitions connects the two states when available.
- Article: [Smoother Navigation with CSS Page Transitions](/articles/page-transitions/)
- Support/fallback: Without View Transitions, the button changes views immediately. This is a same-document navigation preview; real article routes remain normal links.

## Rethinking CSS Resets for Modern CSS

- Demo: modern-resets
- Interaction: Compare content-box with border-box. Both frames request the same width and padding.
- Article: [Rethinking CSS Resets for Modern CSS](/articles/modern-resets/)

## When Grid Finally Lines Up with subgrid

- Demo: subgrid
- Interaction: Toggle shared tracks. The longer description shows why nested cards benefit from subgrid.
- Article: [When Grid Finally Lines Up with subgrid](/articles/subgrid/)
- Support/fallback: Independent grids keep all card content readable when shared subgrid tracks are unavailable.

## Cleaning Up the Edges with text-margin-trim

- Demo: text-margin-trim
- Interaction: Toggle text-edge trimming and compare the line boxes against the specimen borders. The current CSS property is text-box-trim.
- Article: [Cleaning Up the Edges with text-margin-trim](/articles/text-margin-trim/)
- Support/fallback: Both specimens retain their original line boxes in this browser. The article’s older property name needs editorial review.

## When Flexbox Needs to Play It Safe

- Demo: flex-safe
- Interaction: Add more invitations, then choose safe centering. Overflow should begin where the first item stays reachable.
- Article: [When Flexbox Needs to Play It Safe](/articles/flex-safe/)

## Smarter Color, Less Guesswork with color-mix()

- Demo: color-mix
- Interaction: Adjust the amber proportion. Compare two real CSS color spaces; the labels stay readable independently of the swatches.
- Article: [Smarter Color, Less Guesswork with color-mix()](/articles/color-mix/)
- Support/fallback: Fixed green swatches remain visible here. Color mixing does not guarantee text contrast; labels use a separate fixed palette.

## Smarter Selectors with :is(), :where(), and :has()

- Demo: smart-selectors
- Interaction: Include a cover image. :has() notices the content; :is() groups matching elements and :where() keeps the baseline selector gentle.
- Article: [Smarter Selectors with :is(), :where(), and :has()](/articles/smart-selectors/)

## Taking Control of Intrinsic Sizes with calc-size()

- Demo: calc-size
- Interaction: Ask for extra room around an intrinsically sized note. Supported browsers calculate from auto instead of guessing a fixed height.
- Article: [Taking Control of Intrinsic Sizes with calc-size()](/articles/calc-size/)
- Support/fallback: calc-size() is unavailable here. The note keeps its ordinary content-based height rather than clipping content.

## Sizing Components with Container Query Units

- Demo: fluid-type
- Interaction: Resize the card to scale its typography with cqi units and clamp().
- Article: [Sizing Components with Container Query Units](/articles/container-query-units/)

## Structuring the Cascade with @layer

- Demo: the-layer-rule
- Interaction: Compare two declared layer orders. The selectors are identical in strength; the order of the layers decides the border.
- Article: [Structuring the Cascade with @layer](/articles/the-layer-rule/)
- Support/fallback: This example uses normal declarations. Important declarations reverse layer precedence; unlayered normal styles also have different precedence.

## Handling Discrete Changes with transition-behavior

- Demo: transition-behavior
- Interaction: Show and hide the note. Supporting browsers coordinate opacity with the discrete display change.
- Article: [Handling Discrete Changes with transition-behavior](/articles/transition-behavior/)
- Support/fallback: The checkbox still opens and closes the note immediately when discrete transitions are unsupported.

## Give a List One Motion Budget, Not Forty Delays

- Demo: sibling-index
- Interaction: Switch between seven and forty notes and replay the decorative entrance. Every line of text is readable immediately.
- Article: [Give a List One Motion Budget, Not Forty Delays](/articles/sibling-index/)
- Support/fallback: This browser shows a static, fully readable list. The motion budget is capped at the fifth note when sibling-index() is supported.

Reference checks: [MDN text-box-trim](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box-trim), [MDN calc-size()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/calc-size), [MDN scroll-state queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries).
