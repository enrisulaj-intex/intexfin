import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canSeeAll, getCurrentUser } from "@/lib/session";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Pa autorizim" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      transaction: {
        select: {
          createdById: true,
          account: { select: { ownerId: true } },
        },
      },
    },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Dokumenti nuk u gjet" }, { status: 404 });
  }

  const { transaction } = attachment;
  const allowed =
    canSeeAll(user.role) ||
    transaction.createdById === user.id ||
    transaction.account?.ownerId === user.id;
  if (!allowed) {
    return NextResponse.json({ error: "Pa akses" }, { status: 403 });
  }

  // fileName gjenerohet nga randomUUID; e verifikojmë sërish para leximit.
  if (!/^[A-Za-z0-9._-]+$/.test(attachment.fileName)) {
    return NextResponse.json({ error: "Skedar i pavlefshëm" }, { status: 400 });
  }

  try {
    const file = await readFile(path.join(UPLOAD_DIR, attachment.fileName));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          attachment.originalName,
        )}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json({ error: "Skedari mungon në server" }, { status: 404 });
  }
}
