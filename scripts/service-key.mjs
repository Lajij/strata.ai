const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/;

function isServerKey(value) {
  if (!value) {
    return false;
  }

  if (value.startsWith("sb_secret_")) {
    return true;
  }

  if (JWT_PATTERN.test(value)) {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString("utf8"));
      return payload.role === "service_role";
    } catch {
      return false;
    }
  }

  return false;
}

export function resolveServiceKey(env = process.env) {
  const secret = env.SUPABASE_SECRET_KEY;
  const legacy = env.SUPABASE_SERVICE_ROLE_KEY;

  if (isServerKey(secret)) {
    return secret;
  }

  if (secret && isServerKey(legacy)) {
    console.warn(
      "SUPABASE_SECRET_KEY is set but is not a server credential (expected an sb_secret_ key or a service_role JWT); falling back to SUPABASE_SERVICE_ROLE_KEY. Fix the SUPABASE_SECRET_KEY value in .env.local.",
    );
    return legacy;
  }

  if (isServerKey(legacy)) {
    return legacy;
  }

  return secret || legacy || undefined;
}
