import { MongoClient, Db, MongoClientOptions } from "mongodb"
import { mockDb } from "./mock-db"

declare global {
  var __mongoClient: Promise<MongoClient> | undefined
}

const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI
const dbName = process.env.MONGODB_DB || "backoffice"
const serverSelectionTimeoutMS = Number(process.env.MONGODB_TIMEOUT_MS ?? 10_000)
const useMockDb = process.env.MOCK_DB === "true"
const allowMockFallback = process.env.MOCK_DB_FALLBACK !== "false"

// No log here to avoid noisy warnings during static generation. We'll error on demand in getDb().

export async function getDb(): Promise<Db> {
  if (useMockDb) return mockDb as unknown as Db
  if (!uri) {
    if (allowMockFallback) return mockDb as unknown as Db
    throw new Error("MONGODB_URI no configurado")
  }
  const options: MongoClientOptions = { serverSelectionTimeoutMS }

  if (!globalThis.__mongoClient) {
    globalThis.__mongoClient = new MongoClient(uri, options).connect()
  }

  try {
    const client = await globalThis.__mongoClient
    return client.db(dbName)
  } catch (err) {
    // Clear cached client after a failed attempt to allow fresh retries.
    globalThis.__mongoClient = undefined
    if (allowMockFallback) return mockDb as unknown as Db
    throw err
  }
}
