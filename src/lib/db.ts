import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPoolTimeoutError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        String((error as { code?: unknown }).code) === "P2024"
    );
}

export async function withPrismaPoolRetry<T>(
    operation: () => Promise<T>,
    options?: { retries?: number; delayMs?: number },
): Promise<T> {
    const retries = options?.retries ?? 2;
    const delayMs = options?.delayMs ?? 200;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (!isPoolTimeoutError(error) || attempt === retries) {
                throw error;
            }
            await sleep(delayMs * (attempt + 1));
        }
    }

    throw lastError;
}
