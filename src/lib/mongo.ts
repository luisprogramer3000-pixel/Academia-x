import { MongoClient, type Db } from "mongodb";

/**
 * Conexión a MongoDB (Biblioteca de la plataforma). Una sola conexión por
 * proceso, reutilizada entre peticiones (y entre recargas en desarrollo).
 *
 * Variables: MONGODB_URI (cadena de conexión de MongoDB Atlas) y, opcional,
 * MONGODB_DB (nombre de la base de datos; por defecto "mentor_studio").
 */

const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function getMongoDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("La biblioteca no está configurada: falta MONGODB_URI.");
  if (!globalForMongo.mongoClient) {
    const client = new MongoClient(uri, {
      appName: "mentor-studio-global",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
    globalForMongo.mongoClient = client.connect().catch((error) => {
      // Si falla la conexión, el siguiente intento vuelve a probar
      globalForMongo.mongoClient = undefined;
      throw error;
    });
  }
  const client = await globalForMongo.mongoClient;
  return client.db(process.env.MONGODB_DB || "mentor_studio");
}
