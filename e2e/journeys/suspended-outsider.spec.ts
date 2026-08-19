import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, personaCredentials } from "../fixtures/personas";
import { gotoApp, signIn } from "../lib/app";

/**
 * Suspended + outsider journey. A suspended member signs in at the auth level
 * but the dashboard stays locked (no active member row), and an anonymous
 * outsider sees only the sign-in gate. Both are rejected by the Data API.
 * Asserts real DOM (locked heading, absence of the authenticated sidebar) and
 * HTTP status / JSON body, never source-string inspection.
 */
test.describe("suspended and outsider access", () => {
  test("suspended member signs in but the dashboard stays locked", async ({ page }) => {
    const { email, password } = personaCredentials("suspended");

    await gotoApp(page);
    await signIn(page, email, password as string, { expectLocked: true });

    // Locked gate: the signed-out heading + locked message remain.
    await expect(
      page.getByRole("heading", { name: "Sign in with an active committee account" }),
    ).toBeVisible();
    await expect(page.getByText("The dashboard stays locked")).toBeVisible();
    // The authenticated sidebar never renders for a locked session.
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

    // The Data API also rejects the suspended session.
    const api = await authenticatedRequest("suspended");
    try {
      const data = await api.get("/api/app-data");
      expect(data.status()).toBe(200);
      const body = await data.json();
      expect(body.auth?.mode).toBe("signed-out");
      expect(body.cards ?? []).toEqual([]);

      const write = await api.post("/api/workflow/create-card", {
        data: { title: "should not persist", description: "blocked" },
      });
      expect(write.status()).toBe(401);
    } finally {
      await api.dispose();
    }
  });

  test("outsider sees only the sign-in gate and is rejected by the Data API", async ({ page }) => {
    await gotoApp(page);

    await expect(
      page.getByRole("heading", { name: "Sign in with an active committee account" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

    const api = await authenticatedRequest("outsider");
    try {
      const data = await api.get("/api/app-data");
      expect(data.status()).toBe(200);
      const body = await data.json();
      expect(body.auth?.mode).toBe("signed-out");
      expect(body.cards ?? []).toEqual([]);

      const write = await api.post("/api/workflow/create-card", {
        data: { title: "should not persist", description: "blocked" },
      });
      expect(write.status()).toBe(401);
    } finally {
      await api.dispose();
    }
  });
});
