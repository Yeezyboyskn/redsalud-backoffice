import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

async function run() {
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DB || "backoffice"
  if (!uri) {
    console.error("MONGODB_URI no configurado")
    process.exit(1)
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS ?? 8000) })
  await client.connect()
  const db = client.db(dbName)

  const users = [
    { rut: "147110758", role: "doctor", name: "Adrian Agrado Collazos", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "14645447K", role: "doctor", name: "Adolfo Fernando Borja Chavez", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "103282284", role: "doctor", name: "Adrian Andres Zarate Azocar", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "164994376", role: "jefatura", name: "Monica Andrea Baeza Guerra", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "205380485", role: "jefatura", name: "Oscar Farias Baeza", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "99999999", role: "agendamiento", name: "Nicolas Aravena", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
    { rut: "88888888", role: "agendamiento", name: "Ruben Santander", password: process.env.NEXT_PUBLIC_DOCTOR_PASSWORD },
  ]

  const doctors = [
    {
      rut: "14711075-8",
      rut_clean: "147110758",
      nombre: "Adrian Agrado Collazos",
      especialidad: "Traumatologia",
      pisos: [1],
      boxes: ["101"],
      correo: "doctoragrado@gmail.com",
      telefono: "992764648",
    },
    {
      rut: "14645447-K",
      rut_clean: "14645447K",
      nombre: "Adolfo Fernando Borja Chavez",
      especialidad: "Traumatologia",
      pisos: [3],
      boxes: ["201", "202", "203"],
      correo: "fitoborja@yahoo.com",
      telefono: "998662307",
    },
    {
      rut: "10.328.228-4",
      rut_clean: "103282284",
      nombre: "Adrian Andres Zarate Azocar",
      especialidad: "Neurocirugia",
      pisos: [4],
      boxes: ["301"],
      correo: "dr.adrian.zarate@gmail.com",
      telefono: "995580306",
    },
  ]

  const weekly = [
    { doctor_rut: "147110758", dia_semana: "Jueves", inicio: "08:00", fin: "12:00", boxId: "101", piso: 1, especialidad: "Traumatologia" },
    { doctor_rut: "14645447K", dia_semana: "Martes", inicio: "09:00", fin: "13:00", boxId: "201", piso: 3, especialidad: "Traumatologia" },
    { doctor_rut: "103282284", dia_semana: "Viernes", inicio: "10:00", fin: "14:00", boxId: "301", piso: 4, especialidad: "Neurocirugia" },
  ]

  const blockRequests = [
    { doctor_rut: "147110758", fecha: "2025-01-15", inicio: "09:00", fin: "10:30", motivo: "Cirugia mayor", boxId: "101", estado: "aprobado", createdAt: new Date().toISOString() },
    { doctor_rut: "14645447K", fecha: "2025-01-16", inicio: "11:00", fin: "12:00", motivo: "Libre para recuperativa", boxId: "201", estado: "aprobado", createdAt: new Date().toISOString() },
  ]

  const extraHours = [
    { doctor_rut: "103282284", fecha: "2025-01-20", inicio: "15:00", fin: "17:00", boxId: "301", createdAt: new Date().toISOString() },
  ]

  const bulkUpsert = async (col, docs, keys) => {
    if (!docs.length) return
    const ops = docs.map((doc) => ({
      updateOne: {
        filter: Object.fromEntries(keys.map((k) => [k, doc[k]])),
        update: { $set: doc },
        upsert: true,
      },
    }))
    await db.collection(col).bulkWrite(ops, { ordered: false })
  }

  await bulkUpsert("users", users, ["rut"])
  await bulkUpsert("doctors", doctors, ["rut_clean"])
  await bulkUpsert("weekly_slots_import", weekly, ["doctor_rut", "dia_semana", "inicio", "fin", "boxId"])
  await bulkUpsert("block_requests", blockRequests, ["doctor_rut", "fecha", "inicio", "fin", "boxId"])
  await bulkUpsert("extra_hours", extraHours, ["doctor_rut", "fecha", "inicio", "fin"])

  console.log("Seed completado.")
  await client.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
