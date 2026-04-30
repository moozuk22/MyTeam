import { PrismaClient } from "@prisma/client";

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
    prisma: AppPrismaClient | undefined;
};

const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 200;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDatabaseUrl(rawUrl: string | undefined): string | undefined {
    if (!rawUrl) {
        return undefined;
    }

    try {
        const parsed = new URL(rawUrl);
        const isNeonPoolerHost =
            parsed.hostname.includes("neon.tech") && parsed.hostname.includes("-pooler.");

        if (!parsed.searchParams.has("sslmode")) {
            parsed.searchParams.set("sslmode", "require");
        }

        if (isNeonPoolerHost && !parsed.searchParams.has("pgbouncer")) {
            parsed.searchParams.set("pgbouncer", "true");
        }

        if (!parsed.searchParams.has("connect_timeout")) {
            parsed.searchParams.set("connect_timeout", "15");
        }

        return parsed.toString();
    } catch {
        return rawUrl;
    }
}

function isRetriablePrismaError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
    }

    const code = String((error as { code?: unknown }).code ?? "");
    return code === "P1001" || code === "P2024";
}

function createPrismaClient() {
    const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
    const client = new PrismaClient(
        normalizedDatabaseUrl
            ? {
                datasources: {
                    db: {
                        url: normalizedDatabaseUrl,
                    },
                },
            }
            : undefined,
    );

    return client.$extends({
        query: {
            async $allOperations({ args, query }) {
                let lastError: unknown;

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
                    try {
                        return await query(args);
                    } catch (error) {
                        lastError = error;
                        if (!isRetriablePrismaError(error) || attempt === MAX_RETRIES) {
                            throw error;
                        }

                        await sleep(BASE_RETRY_DELAY_MS * (attempt + 1));
                    }
                }

                throw lastError;
            },
        },
    });
}

export const prisma =
    globalForPrisma.prisma ??
    createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

function isPoolTimeoutError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (String((error as { code?: unknown }).code) === "P2024" ||
            String((error as { code?: unknown }).code) === "P1001")
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
