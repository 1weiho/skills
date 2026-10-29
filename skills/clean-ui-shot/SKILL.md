---
name: clean-ui-shot
description: Shoot polished, framed screenshots of a web app's real UI as cropped images, the app as a rounded, shadowed window on a stage, with padding where the window edge shows and bleed where the crop cuts through. Two styles, asked up front, clean (a soft gray stage) or glass (a gradient coloured from the UI itself, with a frosted white bezel). A house style for docs pages, changelogs, landing pages, and READMEs. Use whenever the user asks for UI screenshots, docs or changelog images, "nice", "framed", "clean", or "cropped" screenshots of their app, or wants existing product screenshots refreshed because the UI changed, even if they don't name this skill or describe the style.
---

# Clean UI shot

The output is an image like a product-page detail shot: a crop of the real
UI, rendered as a window with rounded corners and a shadow on a stage.
Window edges that fall inside the crop get padding; edges where the crop cuts
through the UI bleed off the stage. That contrast is what makes a crop read
as "a detail of a real app" instead of a pasted rectangle, so choose crops
with it in mind.

There are two styles. Both use the same crops and render the UI at the same
scale; only the stage and frame differ.

- **clean** (default): a soft warm-gray gradient stage, a layered neutral
  shadow, 56px of padding. Quiet and consistent; suits docs, changelogs,
  and READMEs, where many shots sit together.
- **glass**: a gradient stage coloured from the shot itself, a frosted,
  semi-transparent white bezel around the window, and 96px of padding. The
  script samples the capture, picks its main hues (saturated brand accents
  count more than large pale areas), and lays soft tints of them into the
  corners, so every product gets its own palette. A dark UI gets deep tones;
  a UI with no colour falls back to the clean stage. Suits landing pages,
  launch posts, and social images.

Everything is captured from the real app running locally, ideally a
throwaway instance with demo data, so the shots show the current UI, not a
mock.

The scripts live in the `scripts/` folder next to this file (written
`<skill>/scripts/` below). They need Node, `playwright` with Chromium, and
`sharp`, resolved from the directory you run them in. If the project doesn't
have them, `npm i playwright sharp` in a scratch directory, run
`npx playwright install chromium` there once, and run the scripts from that
directory.

## Before you start

- **Ask which style the user wants before shooting**, unless they already
  said. Describe both in a sentence each (as above), say which you'd pick for
  where the images will go, and wait for the answer. Use one style per
  batch, so images that sit together match. If the project already has shots
  in one of these styles, say so and suggest matching them.
- **Ask before starting a dev server.** Many people prefer to start their
  own. Explain why the shots need one and propose a throwaway instance on a
  free port. Approval doesn't carry over from an earlier session.
- **Never drive a server or workspace the user is using.** Clicking around a
  real workspace creates, edits, and comments on real data. Prefer a scratch
  copy seeded with the project's demo or fixture data. If the app has none,
  ask what is safe to show.
- Use a scratchpad directory for shot lists and outputs until images are
  final.

## Workflow

1. **Pick the shots.** One image per idea. Show the state that explains the
   feature: a selected element with its panel open, a dialog with real
   results, a list with real-looking rows. For docs, the page's hero image
   usually goes right under the title, with section images under the
   heading they illustrate. For a changelog, only releases worth a picture
   get one.

2. **Start the app** in the background (`run_in_background`) and read its
   output for the ready line and URL. If it fails, fix the cause (missing
   install, stale build) before shooting.

3. **Write a shots file** in the scratchpad. Start from
   `<skill>/scripts/shots.example.mjs`, which has the field reference at the
   top and recipes for full windows, panel crops, menus, command palettes,
   mocked backends, and popups. Read the app's source for real routes,
   accessible names, and visible text, and use them instead of guessing
   selectors.

4. **Shoot.**
   ```bash
   node <skill>/scripts/shoot.mjs <shots.mjs> --url http://127.0.0.1:<port> --out <dir> --style clean|glass [--format png|webp] [--only a,b] [--raw <dir>]
   ```
   Each shot is captured at 3× device scale and composed at 2×, giving a
   2000px-wide image for clean (2160px for glass, whose wider padding widens
   the stage). `--style` applies to every shot; a shot's own `style`
   overrides it. Glass prints the gradient it built for each shot. Pass
   `--raw` to keep the uncomposed captures for debugging.

   The default format is lossless PNG: a master that keeps coloured text
   crisp and that a site's image pipeline (Next `<Image>`, Astro, a CDN) can
   re-encode without compounding loss. Pass `--format webp` for a q86 webp
   at a fraction of the size when the project already keeps its images as
   webp, or when the files are committed and served as-is with no pipeline
   and size matters. Lossy webp subsamples chroma, so small coloured text
   softens slightly. Expect clean PNGs of roughly 100–400 KB and glass PNGs
   of 0.5–1 MB (the stage's film grain doesn't compress losslessly); webp
   is usually under 100 KB in either style.

5. **Look at every image** before using it. To review a batch at once:
   ```bash
   node <skill>/scripts/contact-sheet.mjs <sheet.png> a.png b.png c.png d.png
   ```
   Check for: a crop that slices through a label or pill, empty space
   dominating the frame, text too small to read, a stray hover or focus
   ring, a loading or skeleton state, a toast, odd search matches, the wrong
   page. Fix and reshoot with `--only`.

6. **Place the images** where the project already keeps them (look for an
   existing `public/`, `assets/`, or `docs/images/` folder and match its
   naming and image format).
   - If the site has an image-zoom component, use it so the 2000px detail
     is reachable on click.
   - Alt text describes what the image shows ("The Properties tab showing
     position, size, and alignment controls for a selected headline"), not
     that it is a screenshot.
   - When replacing an image, update alt text that no longer matches, and
     delete files nothing references any more (`git grep` the name first).

7. **Check them in context.** Open the page that uses them, at desktop
   width and in dark mode if the site has one, and confirm the crop still
   reads at the size it's shown.

8. **Clean up.** Stop the server by port and remove any scratch copies:
   ```bash
   kill $(lsof -tiTCP:<port> -sTCP:LISTEN)
   ```
   An exit code of 143 from the background server task just means it was
   killed.

## Choosing crops

- **Viewport:** 1280×800 by default, for home pages and full-window views.
  1280×720 for editor-like layouts, so the work area fills its space instead
  of floating in whitespace.
- **Width:** a docs column shows images at roughly 700 css px. A crop much
  narrower than ~900 UI px gets blown up, and one wider than 1280 shrinks the
  text to unreadable. Panels and dialogs read well at 950–1100 wide.
- **Which edges show:** an edge is padded when the crop touches that side of
  the viewport, and bleeds otherwise. A crop like `{ x: 300, y: 0, w: 980,
  h: 600 }` shows the window's top and right edges and bleeds left and
  bottom, which suits right-side panels. Make every crop touch at least one
  viewport edge, or nothing in the frame shows a window edge.
- **Height:** bleed the bottom (h ≈ 560–620 at 720 tall) rather than showing
  a tall strip of empty panel. Aim for roughly 1.5–1.8 : 1 output.
- **Full window:** omit `crop` for an overview shot. All four edges get
  padding.
- **Consistency:** keep the stage, padding, and radius as the script sets
  them, so new shots match the existing ones. The dark stage is only for
  UIs that are dark themselves.
- **Phones:** for a phone-sized viewport (about 390×844), set `stageW` so
  the UI isn't blown up (≈ 560 for clean, ≈ 640 for glass) and raise
  `radius` to about 40 so the window reads as a phone screen.

## Gotchas

- **Backend-only states:** a scratch instance often lacks a logged-in
  session, live data, or a running job. Mock the responses with `routes`
  and seed client state with `init`. If the app reacts to data arriving
  before the page settles (auto-scrolling, jumping to the latest item),
  delay the mocked responses a few seconds.
- **Popups and new windows:** catch them with `context.waitForEvent('page')`
  before the click that opens them, and return the popup from `setup`.
- **Search and fuzzy menus:** use a query that returns clean, on-topic
  results, or none at all. Wait for `networkidle` when results come from
  the network.
- **Actions that write data:** posting, saving, or commenting changes the
  scratch data, so later shots in the same run show the side effects (a
  badge, a new row). Reset the scratch data for a clean slate.
- **Animation:** the browser runs with reduced motion, but some transitions
  ignore it. Raise `settle` for a shot that catches something mid-animation.
- **Content:** use demo data and generated assets only. Never use real
  people's photos, avatars, names, or emails as sample content. Don't copy
  the user's own work-in-progress data into the scratch project.
- **Glass palette:** check the gradient against the product. A tiny accent
  can outweigh the brand colour, or a large pale area can lose to a small
  icon. If the colours are off, pass a CSS background as the shot's
  `gradient` (start from the one the script printed), and use the same one
  for every shot in the batch.
- **Dark mode:** shoot light by default. Light shots read fine as light
  cards on a dark site. Don't produce dark variants unless asked.
