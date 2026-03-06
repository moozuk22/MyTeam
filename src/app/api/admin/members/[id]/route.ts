import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const token = request.cookies.get("admin_session")?.value;
    const { id } = await params;

    if (!token || !(await verifyAdminToken(token))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Manually delete the cards first since we don't have onDelete: Cascade
        // The error P2003 was because of the foreign key constraint.
        await prisma.card.deleteMany({
            where: { memberId: id },
        });

        // Now delete the member
        await prisma.member.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Member and associated cards deleted successfully" });
    } catch (error) {
        console.error("Member deletion error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
