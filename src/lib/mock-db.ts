// Mock Mongo-like database to allow the app to run without a real MongoDB instance.
// Implements only the subset of methods used by the API routes.

type AnyDoc = Record<string, any>

type FindOptions = {
  projection?: Record<string, 0 | 1>
}

type SortSpec = Record<string, 1 | -1>

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function normalizeId(value: any): string {
  if (value == null) return ""
  if (typeof value === "object" && typeof value.toString === "function") return value.toString()
  return String(value)
}

function matches(doc: AnyDoc, filter: AnyDoc = {}): boolean {
  for (const [key, value] of Object.entries(filter)) {
    const docVal = (doc as AnyDoc)[key]

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("$regex" in value) {
        const pattern = (value as any).$regex ?? ""
        const options = (value as any).$options ?? ""
        const re = new RegExp(String(pattern), String(options))
        if (!re.test(String(docVal ?? ""))) return false
        continue
      }
      if ("$gte" in value || "$lte" in value) {
        const gte = (value as any).$gte
        const lte = (value as any).$lte
        if (gte !== undefined && (docVal ?? "") < gte) return false
        if (lte !== undefined && (docVal ?? "") > lte) return false
        continue
      }
    }

    if (Array.isArray(docVal)) {
      const found = docVal.some((v) => normalizeId(v) === normalizeId(value))
      if (!found) return false
      continue
    }

    if (normalizeId(docVal) !== normalizeId(value)) return false
  }
  return true
}

function applyProjection(doc: AnyDoc, projection?: Record<string, 0 | 1>): AnyDoc {
  if (!projection) return doc
  if (projection._id === 0) {
    const { _id: _omit, ...rest } = doc
    return rest
  }
  return doc
}

class MockCursor<T extends AnyDoc> {
  private docs: T[]

  constructor(docs: T[]) {
    this.docs = docs
  }

  sort(sortSpec: SortSpec = {}): this {
    const entries = Object.entries(sortSpec)
    this.docs.sort((a, b) => {
      for (const [field, dir] of entries) {
        const av = (a as AnyDoc)[field]
        const bv = (b as AnyDoc)[field]
        if (av === bv) continue
        return av > bv ? dir : -dir
      }
      return 0
    })
    return this
  }

  limit(n: number): this {
    this.docs = this.docs.slice(0, n)
    return this
  }

  async toArray(): Promise<T[]> {
    return this.docs
  }
}

class MockCollection<T extends AnyDoc> {
  private seq = 0

  constructor(private name: string, private docs: T[]) {}

  find(filter: AnyDoc = {}, options: FindOptions = {}): MockCursor<T> {
    const filtered = this.docs.filter((doc) => matches(doc, filter)).map((doc) => applyProjection(clone(doc), options.projection))
    return new MockCursor<T>(filtered)
  }

  async insertOne(doc: AnyDoc) {
    const _id = doc._id ?? `${this.name}-${++this.seq}`
    const stored = { ...clone(doc), _id }
    this.docs.push(stored as T)
    return { insertedId: _id }
  }

  async findOneAndUpdate(filter: AnyDoc, update: AnyDoc, options: any = {}) {
    const idx = this.docs.findIndex((d) => matches(d as AnyDoc, filter))
    if (idx === -1) return { value: null }
    const next = { ...(this.docs[idx] as AnyDoc), ...(update.$set ?? {}) }
    this.docs[idx] = next as T
    return { value: options.returnDocument === "after" ? next : (this.docs[idx] as AnyDoc) }
  }

  async updateOne(filter: AnyDoc, update: AnyDoc, options: any = {}) {
    const idx = this.docs.findIndex((d) => matches(d as AnyDoc, filter))
    if (idx === -1) {
      if (options.upsert) {
        const _id = `${this.name}-${++this.seq}`
        const doc = { _id, ...(filter as AnyDoc), ...(update.$set ?? {}) }
        this.docs.push(doc as T)
        return { matchedCount: 0, modifiedCount: 0, upsertedId: _id }
      }
      return { matchedCount: 0, modifiedCount: 0 }
    }
    const next = { ...(this.docs[idx] as AnyDoc), ...(update.$set ?? {}) }
    this.docs[idx] = next as T
    return { matchedCount: 1, modifiedCount: 1, upsertedId: null }
  }

  async deleteOne(filter: AnyDoc) {
    const idx = this.docs.findIndex((d) => matches(d as AnyDoc, filter))
    if (idx === -1) return { deletedCount: 0 }
    this.docs.splice(idx, 1)
    return { deletedCount: 1 }
  }

  async createIndex() {
    return `${this.name}_idx`
  }
}

class MockDb {
  private collections: Record<string, AnyDoc[]> = {}

  constructor(seed: Record<string, AnyDoc[]>) {
    for (const [name, docs] of Object.entries(seed)) {
      this.collections[name] = clone(docs)
    }
  }

  collection<T extends AnyDoc>(name: string): MockCollection<T> {
    if (!this.collections[name]) this.collections[name] = []
    return new MockCollection<T>(name, this.collections[name] as T[])
  }
}

const seedData = {
  doctors: [
    {
      _id: "doc-1",
      rut: "147110758",
      nombre: "Dra. Ana Soto",
      especialidad: "Medicina General",
      pisos: [1, 2],
      boxes: ["101", "102"],
      correo: "ana.soto@example.com",
      telefono: "999111222",
    },
    {
      _id: "doc-2",
      rut: "14645447K",
      nombre: "Adolfo Fernando Borja Chavez",
      especialidad: "Traumatologia",
      pisos: [3],
      boxes: ["201", "202", "203"],
      correo: "fitoborja@yahoo.com",
      telefono: "998652307",
    },
    {
      _id: "doc-3",
      rut: "103282284",
      nombre: "Adrian Andres Zarate Azocar",
      especialidad: "Neurocirugia",
      pisos: [4],
      boxes: ["301"],
      correo: "dr.adrian.zarate@gmail.com",
      telefono: "995580306",
    },
  ],
  weekly_slots_import: [
    { doctor_rut: "147110758", dia_semana: "Lunes", inicio: "08:00", fin: "12:00", boxId: "101", piso: 1, especialidad: "Medicina General" },
    { doctor_rut: "147110758", dia_semana: "Martes", inicio: "14:00", fin: "18:00", boxId: "102", piso: 2, especialidad: "Medicina General" },
    { doctor_rut: "14645447K", dia_semana: "Jueves", inicio: "09:00", fin: "13:00", boxId: "201", piso: 3, especialidad: "Traumatologia" },
    { doctor_rut: "103282284", dia_semana: "Viernes", inicio: "10:00", fin: "14:00", boxId: "301", piso: 4, especialidad: "Neurocirugia" },
  ],
  block_requests: [
    { _id: "block-1", doctor_rut: "147110758", fecha: "2025-01-15", inicio: "09:00", fin: "10:00", motivo: "Capacitacion", boxId: "101", estado: "aprobado", createdAt: "2025-01-10T12:00:00.000Z" },
    { _id: "block-2", doctor_rut: "14645447K", fecha: "2025-01-16", inicio: "11:00", fin: "12:00", motivo: "Libre para recuperativa", boxId: "201", estado: "aprobado", createdAt: "2025-01-10T12:00:00.000Z" },
  ],
  extra_hours: [
    { _id: "extra-1", doctor_rut: "147110758", fecha: "2025-01-20", inicio: "18:00", fin: "20:00", boxId: "102", createdAt: "2025-01-10T12:00:00.000Z" },
  ],
  specialty_floors: [
    { especialidad: "Medicina General", pisos: [1, 2], updatedAt: "2025-01-10T12:00:00.000Z" },
    { especialidad: "Traumatologia", pisos: [3], updatedAt: "2025-01-10T12:00:00.000Z" },
  ],
}

export const mockDb = new MockDb(seedData)

export type { MockDb }
