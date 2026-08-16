const rawFailure =
  "simulated upstream failure with private row detail and sb_secret_must-not-be-exposed";

export const Output = {
  object() {
    return {};
  },
};

export async function generateText() {
  throw new Error(rawFailure);
}

export function streamText() {
  throw new Error(rawFailure);
}

export async function buildVisibleAiContext({ task }) {
  return {
    source: "supabase",
    task,
    records: [],
    citations: [],
    query: null,
  };
}

export async function getStrataAppData() {
  throw new Error(rawFailure);
}

export async function getCurrentMember() {
  throw new Error(rawFailure);
}

export async function getSupabaseServerClient() {
  return null;
}
