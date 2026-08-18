import { expect, test } from "../fixtures/personas";
import { authenticatedRequest, readPersonaState, type ApiPersonaName } from "../fixtures/personas";

/**
 * Direct Data-API journey. Per-persona request calls against the real route
 * layer (`/api/finance`, `/api/documents/create`, `/api/workflow`,
 * `/api/app-data`) asserting the capability matrix: authorized personas get
 * HTTP 200 + a Supabase-mode JSON body; unauthorized personas get 403
 * (capability) or 401 (no active member / no session). Records created by
 * authorized personas carry the run marker so teardown removes them. Asserts
 * HTTP status + JSON body only; no source-string inspection.
 */

interface Expectation {
  finance: number;
  documents: number;
  workflow: number;
  appDataMode: "active" | "signed-out";
}

const MATRIX: { persona: ApiPersonaName; expect: Expectation }[] = [
  { persona: "admin", expect: { finance: 200, documents: 200, workflow: 200, appDataMode: "active" } },
  {
    persona: "financialConfirmer",
    expect: { finance: 200, documents: 200, workflow: 200, appDataMode: "active" },
  },
  { persona: "member", expect: { finance: 403, documents: 200, workflow: 200, appDataMode: "active" } },
  { persona: "readOnly", expect: { finance: 403, documents: 403, workflow: 403, appDataMode: "active" } },
  {
    persona: "suspended",
    expect: { finance: 401, documents: 401, workflow: 401, appDataMode: "signed-out" },
  },
  {
    persona: "outsider",
    expect: { finance: 401, documents: 401, workflow: 401, appDataMode: "signed-out" },
  },
];

test.describe("direct Data-API capability matrix", () => {
  for (const { persona, expect: expected } of MATRIX) {
    test(`${persona} finance/documents/workflow/app-data`, async () => {
      const { marker } = readPersonaState();
      const api = await authenticatedRequest(persona);

      try {
        const finance = await api.post("/api/finance/create-vendor", {
          data: { name: `${marker} vendor (${persona})` },
        });
        expect(finance.status()).toBe(expected.finance);
        if (finance.status() === 200) {
          const body = await finance.json();
          expect(body.mode).toBe("supabase");
          expect(body.id).toBeTruthy();
        }

        const document = await api.post("/api/documents/create", {
          data: { title: `${marker} doc (${persona})`, documentType: "Test", visibility: "all" },
        });
        expect(document.status()).toBe(expected.documents);
        if (document.status() === 200) {
          const body = await document.json();
          expect(body.mode).toBe("supabase");
          expect(body.id).toBeTruthy();
        }

        const workflow = await api.post("/api/workflow/create-card", {
          data: {
            title: `${marker} card (${persona})`,
            description: "E2E direct Data-API capability probe",
            type: "general",
            visibility: "all",
          },
        });
        expect(workflow.status()).toBe(expected.workflow);
        if (workflow.status() === 200) {
          const body = await workflow.json();
          expect(body.mode).toBe("supabase");
          expect(body.id).toBeTruthy();
        }

        const appData = await api.get("/api/app-data");
        expect(appData.status()).toBe(200);
        const appBody = await appData.json();
        expect(appBody.auth?.mode).toBe(expected.appDataMode);
        if (expected.appDataMode === "signed-out") {
          expect(appBody.cards ?? []).toEqual([]);
          expect(appBody.documents ?? []).toEqual([]);
        } else {
          expect(Array.isArray(appBody.cards)).toBe(true);
        }
      } finally {
        await api.dispose();
      }
    });
  }
});
