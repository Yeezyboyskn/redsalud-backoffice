import { MongoClient } from "mongodb"
import dotenv from "dotenv"

// Carga primero .env.local y luego .env como fallback
dotenv.config({ path: ".env.local" })
dotenv.config()

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "backoffice"

if (!uri) {
  console.error("MONGODB_URI no configurado")
  process.exit(1)
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS ?? 8000) })

async function upsertMany(col, docs, keys) {
  if (!docs.length) return
  const ops = docs.map((doc) => ({
    updateOne: {
      filter: Object.fromEntries(keys.map((k) => [k, doc[k]])),
      update: { $set: doc },
      upsert: true,
    },
  }))
  await col.bulkWrite(ops, { ordered: false })
}

async function run() {
  await client.connect()
  const db = client.db(dbName)

  const specialties = [
    { code: "MED-GEN", nombre: "Medicina General" },
    { code: "TRAUMA", nombre: "Traumatología" },
    { code: "NEURO", nombre: "Neurocirugía" },
  ]

  const sites = [{ code: "SCL-001", nombre: "RedSalud Santiago Centro" }]
  const towers = [{ code: "T1", site: "SCL-001", nombre: "Torre A" }]
  const floors = [
    { code: "P1", tower: "T1", nombre: "Piso 1" },
    { code: "P2", tower: "T1", nombre: "Piso 2" },
    { code: "P3", tower: "T1", nombre: "Piso 3" },
    { code: "P4", tower: "T1", nombre: "Piso 4" },
  ]

  const boxes = [
    { code: "101", floor: "P1", tower: "T1", site: "SCL-001", especialidad: "MED-GEN", estado: "disponible" },
    { code: "102", floor: "P2", tower: "T1", site: "SCL-001", especialidad: "MED-GEN", estado: "disponible" },
    { code: "201", floor: "P3", tower: "T1", site: "SCL-001", especialidad: "TRAUMA", estado: "disponible" },
    { code: "301", floor: "P4", tower: "T1", site: "SCL-001", especialidad: "NEURO", estado: "disponible" },
  ]

  const doctors = [
    {
      rut: "14711075-8",
      rut_clean: "147110758",
      nombre: "Adrian Agrado Collazos",
      especialidad: "TRAUMA",
      pisos: [1],
      boxes: ["101"],
      correo: "doctoragrado@gmail.com",
      telefono: "992764648",
    },
    {
      rut: "14645447-K",
      rut_clean: "14645447K",
      nombre: "Adolfo Fernando Borja Chavez",
      especialidad: "TRAUMA",
      pisos: [3],
      boxes: ["201"],
      correo: "fitoborja@yahoo.com",
      telefono: "998662307",
    },
    {
      rut: "10.328.228-4",
      rut_clean: "103282284",
      nombre: "Adrian Andres Zarate Azocar",
      especialidad: "NEURO",
      pisos: [4],
      boxes: ["301"],
      correo: "dr.adrian.zarate@gmail.com",
      telefono: "995580306",
    },
  ]

  const users = [
    { rut: "147110758", role: "doctor", name: "Adrian Agrado Collazos", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "14645447K", role: "doctor", name: "Adolfo Fernando Borja Chavez", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "103282284", role: "doctor", name: "Adrian Andres Zarate Azocar", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "164994376", role: "jefatura", name: "Monica Andrea Baeza Guerra", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "205380485", role: "jefatura", name: "Oscar Farias Baeza", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "99999999", role: "agendamiento", name: "Nicolas Aravena", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "88888888", role: "agendamiento", name: "Ruben Santander", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
  ]

  const weeklySlots = [
    { doctor_rut: "147110758", dia_semana: "Jueves", inicio: "08:00", fin: "12:00", boxId: "101", piso: 1, especialidad: "TRAUMA" },
    { doctor_rut: "14645447K", dia_semana: "Martes", inicio: "09:00", fin: "13:00", boxId: "201", piso: 3, especialidad: "TRAUMA" },
    { doctor_rut: "103282284", dia_semana: "Viernes", inicio: "10:00", fin: "14:00", boxId: "301", piso: 4, especialidad: "NEURO" },
  ]

  const blockRequests = [
    { doctor_rut: "147110758", fecha: "2025-01-15", inicio: "09:00", fin: "10:30", motivo: "Cirugia mayor", boxId: "101", estado: "aprobado", createdAt: new Date().toISOString() },
    { doctor_rut: "14645447K", fecha: "2025-01-16", inicio: "11:00", fin: "12:00", motivo: "Libre para recuperativa", boxId: "201", estado: "aprobado", createdAt: new Date().toISOString() },
  ]

  const operationalBlocks = [
    { fecha: "2025-02-10", inicio: "08:00", fin: "12:00", boxId: "101", motivo: "mantencion", estado: "pendiente", createdAt: new Date().toISOString() },
  ]

  const extraHours = [
    { doctor_rut: "103282284", fecha: "2025-01-20", inicio: "15:00", fin: "17:00", boxId: "301", createdAt: new Date().toISOString() },
  ]

  await upsertMany(db.collection("specialties"), specialties, ["code"])
  await upsertMany(db.collection("sites"), sites, ["code"])
  await upsertMany(db.collection("towers"), towers, ["code"])
  await upsertMany(db.collection("floors"), floors, ["code"])
  await upsertMany(db.collection("boxes"), boxes, ["code"])
  await upsertMany(db.collection("doctors"), doctors, ["rut"])
  await upsertMany(db.collection("users"), users, ["rut"])
  await upsertMany(db.collection("weekly_slots_import"), weeklySlots, ["doctor_rut", "dia_semana", "inicio", "fin", "boxId"])
  await upsertMany(db.collection("block_requests"), blockRequests, ["doctor_rut", "fecha", "inicio", "fin", "boxId"])
  await upsertMany(db.collection("operational_blocks"), operationalBlocks, ["fecha", "inicio", "fin", "boxId"])
  await upsertMany(db.collection("extra_hours"), extraHours, ["doctor_rut", "fecha", "inicio", "fin"])

  await db.collection("block_requests").createIndex({ doctor_rut: 1, fecha: 1 })
  await db.collection("operational_blocks").createIndex({ fecha: 1, boxId: 1 })
  await db.collection("weekly_slots_import").createIndex({ doctor_rut: 1, dia_semana: 1 })
  await db.collection("extra_hours").createIndex({ doctor_rut: 1, fecha: 1 })
  await db.collection("boxes").createIndex({ code: 1 }, { unique: true })
  await db.collection("doctors").createIndex({ rut: 1 }, { unique: true })
  await db.collection("doctors").createIndex({ rut_clean: 1 })

  console.log("Seed core listo.")
  await client.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
