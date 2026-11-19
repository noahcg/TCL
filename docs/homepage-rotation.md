# Managing A Closer Look

The Editorial Studio has a homepage panel above the research board. It shows the selected topic and six upcoming UTC months. Choose monthly rotation or pin a topic, select included topics, arrange them with Move up / Move down, and edit each topic's public title, headline and explanation. Save & rebuild preview writes `content/homepage-feature.json` and rebuilds the local site. Concurrent edits are rejected, and a failed build restores the previous settings.

Publish that JSON file through the normal Git deployment to apply settings to production. Local settings are not a claim about what is currently live. No API credits are used by rotation. The three curated demos are container queries, fluid typography, and aspect ratio; each has matching implementation and selectable CSS. Add new executable demos in source and verify them before adding them to the catalog.

## Monthly live refresh setup

The site is static. A rebuild selects the topic for the current UTC month; visitors do not depend on JavaScript or a running Studio. The queue repeats after its final entry. A deployment later in the month selects the same topic. Pinning a topic pauses the monthly rotation.

`.github/workflows/homepage-monthly.yml` runs at 10:23 UTC on the first of each month (GitHub may delay scheduled runs). It runs only in `noahcg/thecascadelounge`, the repository connected to production. It validates the site and requests a Vercel production rebuild. A manual workflow dispatch can request a rebuild at any time. It does not modify Git history or require the Mac to remain on.

One-time activation, after publishing the workflow and catalog:

1. In the existing Vercel project, Settings → Git → Deploy Hooks, create a hook for `main` named Monthly homepage.
2. Add that private hook URL as the Actions repository secret `TCL_HOMEPAGE_DEPLOY_HOOK` in `noahcg/thecascadelounge`. Do not put the URL in source or chat.
3. Run Refresh monthly homepage feature manually and confirm the Vercel deployment succeeds.

Without the secret the workflow reports a setup error and the current live feature remains available. A successful hook request means a deployment was requested; check Vercel for completion. Monthly rotation is not activated merely by saving local Studio settings. GitHub may disable schedules on inactive public repositories; check the Actions page if updates stop.
