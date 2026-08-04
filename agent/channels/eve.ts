import { eveChannel } from "eve/channels/eve";
import {
  extractBearerToken,
  ForbiddenError,
  isLoopbackRequest,
  type AuthFn,
  withAuthChallenges,
} from "eve/channels/auth";

import { getEvalFixturePrincipal, isEvalFixtureEnabled } from "../lib/eval-fixtures";
import { getAgentUserClient, getSupabaseIssuer } from "../lib/supabase";

const evalFixture: AuthFn<Request> = (request) => {
  if (!isEvalFixtureEnabled() || !isLoopbackRequest(request)) return null;

  const principal = getEvalFixturePrincipal(request.headers.get("x-strata-eval-principal") ?? "member");
  if (!principal) return null;

  return {
    attributes: {
      committeeId: principal.committeeId,
      evalFixture: "true",
      memberId: principal.memberId,
    },
    authenticator: "http-basic",
    issuer: "strata-eval-fixture",
    principalId: principal.userId,
    principalType: "user",
    subject: principal.userId,
  };
};

const supabaseBearer: AuthFn<Request> = withAuthChallenges(
  async (request) => {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) return null;

    const supabase = getAgentUserClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) return null;

    const { data: memberships, error: membershipError } = await supabase
      .from("members")
      .select("id,committee_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at")
      .limit(20);

    if (membershipError) {
      throw new ForbiddenError({ message: "Active committee membership could not be verified." });
    }

    const requestedCommittee = request.headers.get("x-strata-committee-id")?.trim();
    const membership = requestedCommittee
      ? memberships?.find((candidate) => candidate.committee_id === requestedCommittee)
      : memberships?.length === 1
        ? memberships[0]
        : null;

    if (!membership) {
      throw new ForbiddenError({
        message: memberships?.length
          ? "A verified committee context is required."
          : "An active committee membership is required.",
      });
    }

    return {
      attributes: {
        committeeId: membership.committee_id,
        memberId: membership.id,
      },
      authenticator: "oidc",
      issuer: getSupabaseIssuer(),
      principalId: user.id,
      principalType: "user",
      subject: user.id,
    };
  },
  [{ scheme: "Bearer" }],
);

export default eveChannel({ auth: [evalFixture, supabaseBearer] });
