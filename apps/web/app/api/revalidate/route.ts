import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

const Body = z.strictObject({
  tags: z.array(z.string().regex(/^(suits|suit:[a-z0-9-]{1,80})$/)).min(1).max(20),
});

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret") ?? "";
  if (!expected || !sameSecret(given, expected)) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Bad secret." } }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_failed", message: "Bad tags." } }, { status: 400 });
  }
  for (const tag of parsed.data.tags) revalidateTag(tag, { expire: 0 });
  return new NextResponse(null, { status: 204 });
}
