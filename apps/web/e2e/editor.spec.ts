import { expect, test } from "@playwright/test";

test.describe("Editor smoke", () => {
  test("loads the editor shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Clash Blueprint Engine")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Suggest" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Buildings" })).toBeVisible();
  });

  test("places a building via the library and canvas, driving a command", async ({ page }) => {
    await page.goto("/");

    // Choose a building from the library (activates the Place tool).
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();

    // Click the Konva surface to place it. Konva stacks multiple <canvas>
    // layers, so we click the wrapper with force to bypass the overlay check.
    const surface = page.locator(".cbe-canvas");
    await expect(surface).toBeVisible();
    await surface.click({ position: { x: 220, y: 220 }, force: true });

    // The engine event appears in the live log — proof the command ran end to end.
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    // Undo removes it.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("BuildingDeleted").first()).toBeVisible();
  });

  test("surfaces live rule feedback when placing past a limit (no Validate press)", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();

    const surface = page.locator(".cbe-canvas");
    await expect(surface).toBeVisible();

    // Place 7 cannons on spaced, non-overlapping tiles (TH8 allows 6).
    const spots = [
      { x: 60, y: 60 },
      { x: 160, y: 60 },
      { x: 260, y: 60 },
      { x: 360, y: 60 },
      { x: 460, y: 60 },
      { x: 60, y: 160 },
      { x: 160, y: 160 },
    ];
    for (const position of spots) await surface.click({ position, force: true });

    // WITHOUT pressing "Validate": the library badge is over its max (7/<max>)…
    await expect(page.locator(".cbe-lib-count-max").first()).toHaveText(/^7\/\d+$/);
    // …and the live Validation panel shows the over-limit error.
    await expect(page.getByText(/Too many Cannon/)).toBeVisible();
  });

  test("runs analysis and shows a defense score", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Town Hall/ })
      .first()
      .click();
    await page.locator(".cbe-canvas").click({ position: { x: 300, y: 300 }, force: true });
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByRole("heading", { name: "Defense Score" })).toBeVisible();
    await expect(page.getByText("/100").first()).toBeVisible();
  });

  test("drags a placed building to move it as one undoable command", async ({ page }) => {
    await page.goto("/");

    // Place a cannon on the canvas.
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 240, y: 240 }, force: true });
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    // Switch to the Select tool and drag the building a few tiles.
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const box = await surface.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");
    await page.mouse.move(box.x + 240, box.y + 240);
    await page.mouse.down();
    await page.mouse.move(box.x + 240 + 72, box.y + 240, { steps: 6 });
    await page.mouse.up();

    // The move ran as a command — the event reaches the log.
    await expect(page.getByText("BuildingMoved").first()).toBeVisible();

    // A single undo reverts the whole gesture (append the inverse move).
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("BuildingMoved")).toHaveCount(2);
  });

  test("selects a wall and deletes it via the selection", async ({ page }) => {
    await page.goto("/");

    // Paint a wall.
    await page.getByRole("button", { name: "Wall", exact: true }).click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 360, y: 360 }, force: true });
    await expect(page.getByText("WallAdded").first()).toBeVisible();

    // Select that wall tile, then delete the selection.
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await surface.click({ position: { x: 360, y: 360 }, force: true });
    await page.keyboard.press("Delete");
    await expect(page.getByText("WallRemoved").first()).toBeVisible();
  });

  test("drags a wall to move it, and nudges it with arrow keys", async ({ page }) => {
    await page.goto("/");

    // Paint a wall, then switch to Select and grab it.
    await page.getByRole("button", { name: "Wall", exact: true }).click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 360, y: 360 }, force: true });
    await expect(page.getByText("WallAdded").first()).toBeVisible();

    await page.getByRole("button", { name: "Select", exact: true }).click();
    const box = await surface.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");

    // Drag the wall two tiles right (a WallMoved command runs).
    await page.mouse.move(box.x + 360, box.y + 360);
    await page.mouse.down();
    await page.mouse.move(box.x + 360 + 48, box.y + 360, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText("WallMoved").first()).toBeVisible();

    // Arrow-key nudge also moves the (still-selected) wall.
    await page.keyboard.press("ArrowDown");
    await expect(page.getByText("WallMoved")).toHaveCount(2);
  });

  test("opens a bundled template from the Open menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Open/ }).click();
    await page.getByRole("menuitem", { name: /Starter Base/ }).click();

    // Loading a snapshot replaces the layout (a fresh timeline opens).
    await expect(page.getByText(/Loaded Starter Base/).first()).toBeVisible();
    // Analyze now scores the loaded base (it has buildings).
    await page.getByRole("button", { name: "Analyze" }).click();
    await expect(page.getByRole("heading", { name: "Defense Score" })).toBeVisible();
  });

  test("deploys troops and plays an attack replay", async ({ page }) => {
    await page.goto("/");

    // Load a base to attack.
    await page.getByRole("button", { name: /^Open/ }).click();
    await page.getByRole("menuitem", { name: /Starter Base/ }).click();
    await expect(page.getByText(/Loaded Starter Base/).first()).toBeVisible();

    // Pick a troop (enables Deploy mode) and drop a couple on the canvas.
    await page.getByRole("button", { name: "Barbarian" }).click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 120, y: 120 }, force: true });
    await surface.click({ position: { x: 480, y: 480 }, force: true });
    await expect(page.getByText(/2 placed/)).toBeVisible();

    // Play the attack — a deterministic timeline runs; transport controls appear.
    await page.getByRole("button", { name: /Play Attack/ }).click();
    await expect(page.getByRole("button", { name: "Exit" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Replay time" })).toBeVisible();
  });

  test("opens the shortcuts overlay from the Help button and closes with Esc", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Help" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Known shortcut rows render from the registry.
    await expect(dialog.getByText("Undo", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Select tool", { exact: true })).toBeVisible();

    // Esc closes it.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("new hotkeys: W switches to the Wall tool, R rotates the selection", async ({ page }) => {
    await page.goto("/");

    // Place a building first — the clicks guarantee the app has hydrated before
    // we rely on window-level key handlers.
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 260, y: 260 }, force: true });
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    // W selects the Wall tool (aria-pressed reflects the active tool).
    await page.keyboard.press("w");
    await expect(page.getByRole("button", { name: "Wall", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Select the building and rotate it with R (a command runs → event logged).
    await page.keyboard.press("v"); // Select tool
    await surface.click({ position: { x: 260, y: 260 }, force: true });
    await page.keyboard.press("r");
    await expect(page.getByText("BuildingRotated").first()).toBeVisible();
  });

  test("hand tool: H activates a pan mode with a grab cursor", async ({ page }) => {
    await page.goto("/");

    // A click first guarantees the app has hydrated before window key handlers.
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();

    // H (or the Hand toolbar button) switches to the pan tool.
    await page.keyboard.press("h");
    await expect(page.getByRole("button", { name: "Hand", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The canvas advertises the Figma-style grab affordance.
    await expect(page.locator(".cbe-canvas")).toHaveClass(/cbe-canvas-pan/);
  });

  test("confirms before discarding a non-empty layout when opening a template", async ({
    page,
  }) => {
    await page.goto("/");

    // Put something on the board so there is work to lose.
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();
    await page.locator(".cbe-canvas").click({ position: { x: 240, y: 240 }, force: true });
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    // Opening a template now prompts for confirmation.
    const openTemplate = async (): Promise<void> => {
      await page.getByRole("button", { name: /^Open/ }).click();
      await page.getByRole("menuitem", { name: /Starter Base/ }).click();
    };
    await openTemplate();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    // Cancel keeps the current layout (nothing loaded).
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText(/Loaded Starter Base/)).toHaveCount(0);

    // Reopen and confirm — now it loads.
    await openTemplate();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Discard/ })
      .click();
    await expect(page.getByText(/Loaded Starter Base/).first()).toBeVisible();
  });

  test("filters the building library via the search box", async ({ page }) => {
    await page.goto("/");
    // Both are present initially.
    await expect(page.getByRole("button", { name: /Cannon/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Mortar/ }).first()).toBeVisible();

    await page.getByRole("searchbox", { name: "Search buildings" }).fill("mortar");

    // Only matching buildings remain in the library.
    await expect(page.getByRole("button", { name: /Mortar/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Cannon/ })).toHaveCount(0);
  });

  test("shows a minimap that recenters the view on click", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/");
    const minimap = page.getByRole("img", { name: /Minimap/ });
    await expect(minimap).toBeVisible();

    // Clicking the minimap pans the canvas (no crash, no domain change).
    await minimap.click({ position: { x: 20, y: 20 } });
    expect(errors).toEqual([]);
  });

  test("undo-history panel lists commands and jumps on click", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();
    const surface = page.locator(".cbe-canvas");
    await surface.click({ position: { x: 200, y: 200 }, force: true });
    await surface.click({ position: { x: 340, y: 340 }, force: true });
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    // The History panel lists both "Add building" commands.
    const history = page.locator(".cbe-history");
    await expect(history.getByRole("button", { name: "Add building" })).toHaveCount(2);

    // Clicking the oldest jumps back one step (undo → BuildingDeleted).
    await history.getByRole("button", { name: "Add building" }).first().click();
    await expect(page.getByText("BuildingDeleted").first()).toBeVisible();
  });

  test("exports the layout as a glTF 3D model", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Cannon/ })
      .first()
      .click();
    await page.locator(".cbe-canvas").click({ position: { x: 220, y: 220 }, force: true });
    await expect(page.getByText("BuildingPlaced").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export glTF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("layout.gltf");
  });

  test.describe("Touch input", () => {
    test.use({ hasTouch: true });

    test("places a building via a touch tap", async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("button", { name: /Cannon/ })
        .first()
        .click();
      const surface = page.locator(".cbe-canvas");
      const box = await surface.boundingBox();
      if (!box) throw new Error("canvas has no bounding box");

      // A single-finger tap dispatches pointer events Konva turns into a place.
      await page.touchscreen.tap(box.x + 220, box.y + 220);
      await expect(page.getByText("BuildingPlaced").first()).toBeVisible();
    });
  });

  test("switches the editor UI language to Vietnamese", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "VI", exact: true }).click();

    // Toolbar strings are now Vietnamese; the English label is gone.
    await expect(page.getByRole("button", { name: "Mới", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New", exact: true })).toHaveCount(0);
  });

  test("switches to the 3D view and mounts a WebGL canvas without crashing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/");
    await page.getByRole("button", { name: "3D", exact: true }).click();

    // The three.js canvas mounts in the 3D container (lazy-loaded chunk).
    await expect(page.locator(".cbe-scene3d canvas").first()).toBeVisible({ timeout: 20_000 });

    // Toggling back to 2D restores the Konva canvas.
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await expect(page.locator(".cbe-canvas").first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
