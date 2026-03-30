import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "logiflow-soportes";

let _r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2 no configurado: faltan R2_ACCOUNT_ID, R2_ACCESS_KEY_ID o R2_SECRET_ACCESS_KEY"
    );
  }

  _r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return _r2Client;
}

/**
 * Genera presigned PUT URL para subir un soporte desde el browser.
 * Path: {tenantId}/{codigoCliente}/{timestamp}-{safeName}
 */
export async function generarUrlSubida(
  tenantId: string,
  codigoCliente: string,
  nombreArchivo: string
): Promise<{ uploadUrl: string; objectKey: string }> {
  const safeName = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uid = crypto.randomUUID().slice(0, 8);
  const objectKey = `${tenantId}/${codigoCliente}/${Date.now()}-${uid}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: "image/webp",
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, {
    expiresIn: 300, // 5 minutos
  });

  return { uploadUrl, objectKey };
}

/**
 * Genera presigned GET URL para visualizar un soporte.
 */
export async function generarUrlLectura(
  objectKey: string,
  expiresIn = 3600 // 1 hora
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  return getSignedUrl(getR2Client(), command, { expiresIn });
}

/**
 * Elimina un objeto de R2.
 */
export async function eliminarObjeto(objectKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  await getR2Client().send(command);
}

/**
 * Descarga imagen de R2 como base64 para enviar a la IA.
 */
export async function obtenerImagenParaIA(
  objectKey: string
): Promise<{ base64: string; mimeType: string }> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  const response = await getR2Client().send(command);
  if (!response.Body) {
    throw new Error(`R2: objeto vacío o no encontrado — key: ${objectKey}`);
  }
  const bytes = await response.Body.transformToByteArray();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = response.ContentType ?? "image/webp";

  return { base64, mimeType };
}
