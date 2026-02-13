require('dotenv').config(); // Carga las variables del .env
const postgres = require('postgres');

const connectionString = process.env.POSTGRES_URL;
console.log("🔌 Intentando conectar a:", connectionString);

const sql = postgres(connectionString, { ssl: false }); // Forzamos sin SSL para probar

async function testConnection() {
  try {
    const result = await sql`SELECT 1+1 AS result`;
    console.log("✅ ¡CONEXIÓN EXITOSA! La base de datos responde:", result);
    
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log("📋 Tablas encontradas:", tables.map(t => t.table_name));
    
  } catch (err) {
    console.error("❌ ERROR DE CONEXIÓN:", err);
  } finally {
    await sql.end();
  }
}

testConnection();