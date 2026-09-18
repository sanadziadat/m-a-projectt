# Strategic Rationale Diagnostic (M&A)

A working diagnostic for the **strategic rationale phase** of an M&A deal: the point
before diligence, when the case for doing the deal at all is still being formed.

It rates how well-supported and internally coherent a rationale is. It does **not**
predict whether the deal will succeed.

## What it does

- **Six dimensions**, three pointed statements each, rated 1–5, with a notes field
  per dimension for supporting evidence or doubts.
  1. Strategic fit
  2. Value creation logic
  3. Alternatives considered
  4. Timing and market context
  5. Executive sponsorship and alignment
  6. Risk to thesis
- **Dimension scores and an overall rationale-strength score**, with plain-language
  feedback that names what is actually weak and what to do about it, rather than
  just showing a number. Feedback also covers patterns a single number hides:
  strong fit with no value mechanism, high conviction with untested alternatives,
  a timing case with no executive owner, high ratings with no evidence recorded.
- **Per-dimension weighting** (1–5). One deal hinges on sponsorship alignment,
  another on timing; weights change the overall score and the ordering of the
  weaknesses reported.
- **Dealbreaker flags.** Record the conditions and assumptions a dimension rests
  on and mark each untested, met, or unmet. Any unmet condition flags that
  dimension as a potential dealbreaker, independent of the score.
- **Business context or trigger** captured per deal: what actually put this deal
  on the table.
- **Objectives.** The strongest-scoring parts of the rationale are translated into
  two or three concrete objectives the eventual target should be measured against.
  They arrive as editable templates with bracketed values to fill in.
- **Revisitable.** Every deal is saved as you type and can be reopened and updated
  as thinking develops.
- **Comparable.** Multiple candidate deals run through the same diagnostic and are
  compared side by side: scores, weights, dealbreakers, coverage, weakest point,
  trigger, and objectives.

## Scoring

A dimension score is the mean of its rated statements; unrated statements are
excluded rather than counted as zero, and the summary reports coverage. The overall
score is the weighted mean of the dimension scores.

| Score | Band |
| --- | --- |
| 4.25 – 5.00 | Strong |
| 3.50 – 4.24 | Well-supported |
| 2.50 – 3.49 | Developing |
| 0.00 – 2.49 | Weak |

## Data

Client-side only. There is no backend, no database, and no external API call or data
feed. Everything lives in the browser's `localStorage`, so data persists per device
and per browser.

- **Export** downloads a JSON backup of every deal (or of a single deal from the
  deal header).
- **Import** restores from that file, either merging with what is already in the
  browser (newer copies win, matched by deal ID) or replacing it.

Export/Import is the only way to move data between devices or browsers.

## Running it

It is a static site with no build step.

```
npx serve .          # or any static file server
npm test             # run the scoring test suite (no dependencies)
```

## Deploying

Zero configuration on Vercel: the repository is a static site with `index.html` at
the root, so there is no framework preset or build command to set. `vercel.json`
only sets cache and security headers.

## Layout

```
index.html           markup and app shell
styles.css           styling, light and dark, responsive, print
js/dimensions.js     the six dimensions, statements, feedback text, objective templates
js/scoring.js        scoring, feedback, coherence checks, objective selection (pure functions)
js/app.js            state, localStorage persistence, rendering, compare, export/import
tests/scoring.test.js  scoring tests, run with `node tests/scoring.test.js`
```
