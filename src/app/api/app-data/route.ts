import { NextResponse } from "next/server";
import { runtimeFailureResponse } from "@/lib/runtime-configuration";
import { getStrataAppData } from "@/lib/strata-app-data";

export async function GET(request: Request) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  try {
    const data = await getStrataAppData(accessToken);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return runtimeFailureResponse(error);
  }
}
