// Recipes for the kinds of UI states worth shooting. Copy the ones you need
// into a shots file in your scratchpad, then swap in the app's real paths,
// selectors, and crops. Prefer selectors by role, label, or visible text
// (getByRole, getByText, getByTitle): they survive restyling.
//
// Shot fields:
//   name        output file name (<name>.png, or .webp with --format webp)
//   path        route to open first, relative to --url. Optional when setup
//               navigates itself.
//   viewport    { width, height } in CSS px. Default 1280×800. 1280×720 for
//               editor-like layouts so the work area fills the frame.
//   crop        { x, y, w, h } in CSS px of the viewport. Omit for the full
//               window. Edges touching the viewport get padding, inner edges
//               bleed. Keep w ≥ ~900 so UI text stays legible in a docs column.
//   style       'clean' or 'glass'. Overrides --style for this shot; keep
//               one style per batch.
//   colorScheme 'light' (default) or 'dark', passed to the browser.
//   stage       'light' or 'dark'. In clean it follows colorScheme, in glass
//               the shot's brightness, unless set; set it for UIs that are
//               dark regardless of the scheme.
//   gradient    a CSS background for the stage, replacing the default (clean)
//               or the palette read from the shot (glass).
//   init        function run in the page before load (localStorage seeding).
//   routes      async (context) => {} to mock network routes.
//   setup       async ({ page, context, base }) => {}; may return another
//               page (a popup) to shoot instead.
//   beforeShot  async ({ page }) => {} right before the capture (hover etc.).
//   settle      ms to wait after setup (default 700).
//   pad, radius, stageW, bezel
//               override the frame (bezel is glass only). Extra padding
//               widens the stage instead of shrinking the UI. Leave them
//               alone so shots match, except for phone shots.

const EDITOR = { width: 1280, height: 720 };

export default [
  {
    // Full window: all four edges padded. Good for an overview.
    name: 'overview',
    path: '/',
    async setup({ page }) {
      await page.getByRole('heading', { level: 1 }).first().waitFor();
    },
  },
  {
    // Top strip of a long page: top, left, and right edges show, the bottom
    // bleeds instead of trailing off into empty content.
    name: 'home',
    path: '/',
    crop: { x: 0, y: 0, w: 1280, h: 680 },
  },
  {
    // A right-side panel with something selected: crop touches the top and
    // right edges, bleeds left and bottom.
    name: 'inspector',
    path: '/projects/demo',
    viewport: EDITOR,
    crop: { x: 300, y: 0, w: 980, h: 600 },
    async setup({ page }) {
      await page.getByText('Quarterly plan').first().click();
      await page.getByRole('tab', { name: 'Properties' }).click();
    },
  },
  {
    // A menu, hovered so the active row is visible.
    name: 'export-menu',
    path: '/projects/demo',
    viewport: EDITOR,
    crop: { x: 330, y: 0, w: 950, h: 560 },
    async setup({ page }) {
      await page.getByRole('button', { name: 'Export' }).click();
      await page.getByText('Export as PDF').waitFor();
    },
    async beforeShot({ page }) {
      await page.getByText('Export as PDF').hover();
    },
  },
  {
    // A command palette opened by shortcut. Shoot it with no query unless a
    // query gives clean, on-topic results.
    name: 'command-menu',
    path: '/',
    crop: { x: 90, y: 0, w: 1100, h: 660 },
    async setup({ page }) {
      await page.waitForTimeout(1000);
      await page.keyboard.press('Meta+k');
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    // A state that needs a backend the scratch instance doesn't have: mock
    // the responses, and seed client state before the app boots.
    name: 'activity-panel',
    path: '/projects/demo',
    viewport: EDITOR,
    crop: { x: 300, y: 0, w: 980, h: 600 },
    init: () => {
      localStorage.setItem('activity-panel-open', '1');
    },
    async routes(context) {
      await context.route('**/api/activity', (route) =>
        route.fulfill({
          json: {
            items: [
              { id: 1, actor: 'Avery', action: 'renamed the deck', at: '2 min ago' },
              { id: 2, actor: 'Sam', action: 'added 3 slides', at: '9 min ago' },
            ],
          },
        }),
      );
    },
  },
  {
    // A phone viewport. A narrower stage keeps the 390px UI from being blown
    // up (about 640 for glass, 560 for clean), and a larger radius reads as
    // a phone screen.
    name: 'share-sheet-mobile',
    path: '/projects/demo',
    viewport: { width: 390, height: 844 },
    stageW: 560,
    radius: 40,
    async setup({ page }) {
      await page.getByRole('button', { name: 'Share' }).click();
      await page.getByRole('dialog').waitFor();
    },
  },
  {
    // A popup window, caught as it opens and shot instead of the main page.
    // A dark UI gets the dark stage.
    name: 'presenter',
    path: '/projects/demo',
    stage: 'dark',
    viewport: { width: 1280, height: 760 },
    async setup({ page, context }) {
      const popup = context.waitForEvent('page');
      await page.getByRole('button', { name: 'Present' }).click();
      const presenter = await popup;
      await presenter.setViewportSize({ width: 1280, height: 760 });
      await presenter.waitForLoadState();
      await presenter.waitForTimeout(2000);
      return presenter;
    },
  },
];
