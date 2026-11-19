# Scheduling A Closer Look

## The simple path

1. Restart Editorial Studio after installing this update.
2. Open **A Closer Look → Schedule demos**.
3. Pick an article demo beside a month, or click **Fill unused articles** to fill future months with the remaining article demos.
4. Click **Save schedule**. The local homepage preview rebuilds immediately; saving also turns monthly scheduling on if a demo was pinned.
5. Publish `content/homepage-feature.json` through the normal Git deployment to apply the saved schedule to the live site.

The scheduler shows 18 named months. An empty month keeps the previous demo. After the last scheduled change, that final demo remains in place. Demos cannot appear twice in the schedule. Used demos are disabled in schedule choices; deliberate manual reuse is available through **Show this demo → Use demo**.

**Saving a schedule does not by itself activate unattended live deployment.** The live site needs the one-time connection below. Local settings and scheduled history do not independently verify what is live.

## Prepared monthly schedule

The November 2026 container-query feature stays in place. The remaining 15 articles are assigned below. These choices are prepared locally; publish the settings and connect monthly live refresh to apply them to production.

| Month | Article demo |
| --- | --- |
| 2026-12 | Scrolling Gets Smarter with Markers, Buttons, and Scroll State |
| 2027-01 | Understanding CSS Specificity (Without the Headaches) |
| 2027-02 | Responsive Components with CSS Style Queries |
| 2027-03 | Positioning UI the Native Way with Popovers and Anchors |
| 2027-04 | Smoother Navigation with CSS Page Transitions |
| 2027-05 | Rethinking CSS Resets for Modern CSS |
| 2027-06 | When Grid Finally Lines Up with subgrid |
| 2027-07 | Cleaning Up the Edges with text-margin-trim |
| 2027-08 | When Flexbox Needs to Play It Safe |
| 2027-09 | Smarter Color, Less Guesswork with color-mix() |
| 2027-10 | Smarter Selectors with :is(), :where(), and :has() |
| 2027-11 | Taking Control of Intrinsic Sizes with calc-size() |
| 2027-12 | Structuring the Cascade with @layer |
| 2028-01 | Handling Discrete Changes with transition-behavior |
| 2028-02 | Give a List One Motion Budget, Not Forty Delays |

Changing a month to a demo already assigned elsewhere moves that assignment rather than creating a duplicate. Clearing every assignment pins the current demo instead of restarting the old queue.

## Preview and choose

**Article demos** contains a playable example for every one of the 16 current published articles. Each row has **Preview demo**, **Use now**, **Choose a month**, and its real article link. Preview opens the demo without changing your selection or consuming an idea. Use now rebuilds and pins the local feature; Choose a month opens the scheduler with a draft month choice that you must save.

There are 18 working selections: the 16 article examples plus the original container-query layout and aspect-ratio extras. The container-query-units article uses the existing fluid-type demo. Experimental features display a readable fallback and support note where needed. All snippets come from the CSS actually served to the demo; some controls also update content with JavaScript.

## Demonstrated history

`usedDemos` and `usedArticles` retain append-only history in the settings file. Switching records local use. Scheduled topics through the current UTC month also count as used in the local schedule. The released container-query example is seeded as demonstrated. Related examples for the same article stay out of automatic suggestions.

The article list defaults to **Not demonstrated**; completed items remain under **Demonstrated** or **All article demos**. Renaming a title does not erase its stable article identity. Duplicate proposal IDs/titles and duplicate schedule selections are rejected. A manual **Mark demonstrated** action is available for demos shown elsewhere.

## One-time automatic live refresh connection

The website is static. A production rebuild selects the demo assigned to the current UTC month. No Mac or running Studio is required for the monthly job.

After publishing the workflow and catalog:

1. In the existing Vercel project, Settings → Git → Deploy Hooks, create a hook for `main` named Monthly homepage.
2. Store that private hook URL as the Actions repository secret `TCL_HOMEPAGE_DEPLOY_HOOK` in `noahcg/thecascadelounge`. Do not put the URL in source or chat.
3. Run **Refresh monthly homepage feature** manually in GitHub Actions and confirm that Vercel finishes the deployment.

The workflow runs at 10:23 UTC on the first day of each month; GitHub may delay it. Without the secret it reports a setup error and the existing feature stays available. A successful hook request means a deployment was requested, not that Vercel has finished it. Check the Actions and Vercel dashboards if updates stop.

## Advanced settings

The older start-month/queue controls remain collapsed under **Edit copy → Advanced rotation settings** for compatibility. Explicit month assignments take precedence. For a new schedule, use the named month choices rather than editing the legacy queue. Saving copy or schedules rejects concurrent changes and restores settings if the preview build fails.
