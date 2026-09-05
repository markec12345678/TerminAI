import { NextResponse } from "next/server";

/** Health-check korenska API pot (prej dev ostanek "Hello, world!"). */
export async function GET() {
  return NextResponse.json({
    app: "TerminAI",
    status: "ok",
    jezik: "sl-SI",
  });
}
