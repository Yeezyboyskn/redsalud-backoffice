import { MongoClient } from "mongodb"
import dotenv from "dotenv"

// Carga primero .env.local y luego .env como fallback
dotenv.config({ path: ".env.local" })
dotenv.config()

const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI
const dbName = process.env.MONGODB_DB || "backoffice"

// Función para limpiar RUT (solo números y K)
function cleanRut(rut) {
  return rut ? rut.toUpperCase().replace(/[^0-9K]/g, "") : ""
}

async function createAdminUser() {
  if (!uri) {
    console.log("⚠️  MONGODB_URI no configurado. El usuario se agregará solo al mock.")
    console.log("✅ Usuario agregado a mock-roles.ts")
    console.log("   RUT: 12.345.678-9")
    console.log("   Clave: admin123")
    console.log("   Rol: admin")
    return
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS ?? 8000) })
  
  try {
    await client.connect()
    const db = client.db(dbName)
    
    const rut = "12.345.678-9"
    const rutClean = cleanRut(rut)
    const password = "admin123"
    const role = "admin"
    const name = "Administrador"
    
    // Crear o actualizar usuario
    const result = await db.collection("users").updateOne(
      { rut: rutClean },
      { 
        $set: { 
          rut: rutClean,
          role: role,
          name: name,
          password: password,
          createdAt: new Date().toISOString()
        } 
      },
      { upsert: true }
    )
    
    if (result.upsertedCount > 0) {
      console.log("✅ Usuario admin creado exitosamente")
    } else {
      console.log("✅ Usuario admin actualizado exitosamente")
    }
    
    console.log(`   RUT: ${rut}`)
    console.log(`   RUT limpio: ${rutClean}`)
    console.log(`   Clave: ${password}`)
    console.log(`   Rol: ${role}`)
    console.log(`   Nombre: ${name}`)
    
    await client.close()
  } catch (err) {
    console.error("❌ Error al crear usuario:", err.message)
    console.log("⚠️  El usuario está disponible en mock-roles.ts para uso con base de datos mock")
    process.exit(1)
  }
}

createAdminUser().catch((err) => {
  console.error(err)
  process.exit(1)
})

