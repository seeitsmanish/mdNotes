import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { createShare, getShareToken, revokeShare } from "@/lib/db/shares";

type Params = { params: Promise<{ id: string }> };

/** The note's public link, if any (PRD §4.68). */
async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json({ token: await getShareToken(id) });
}

async function handlePOST(_request: Request, { params }: Params) {
  const { id } = await params;
  const token = await createShare(id);
  if (!token) return NextResponse.json({ error: "This note can’t be shared — it is locked, in the trash, or gone." }, { status: 409 });
  return NextResponse.json({ token }, { status: 201 });
}

async function handleDELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await revokeShare(id);
  return new Response(null, { status: 204 });
}

export const GET = guarded(handleGET);
export const POST = guarded(handlePOST);
export const DELETE = guarded(handleDELETE);
