import { MongoClient, Db } from "mongodb"

declare global {
  var __mongoClient: Promise<MongoClient> | undefined
}

const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI
const dbName = process.env.MONGODB_DB || "backoffice"

// No log here to avoid noisy warnings during static generation. We'll error on demand in getDb().

export async function getDb(): Promise<Db> {
  if (!uri) throw new Error("MONGODB_URI no configurado")
  if (!globalThis.__mongoClient) {
    globalThis.__mongoClient = new MongoClient(uri).connect()
  }
  const client = await globalThis.__mongoClient
  return client.db(dbName)
}
