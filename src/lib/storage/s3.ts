import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Image/photo storage on Supabase Storage via the S3 protocol.
 *
 * Bucket is PRIVATE, so objects are never world-readable: we store the object
 * KEY (e.g. "pets/<userId>/<uuid>.jpg") and mint short-lived presigned GET URLs
 * on read. Config comes from Vercel env vars:
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET
 */

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 storage is not configured (need S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).",
    );
  }
  client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    // Required for Supabase Storage's S3 endpoint (and other non-AWS S3s).
    forcePathStyle: true,
  });
  return client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not set");
  return bucket;
}

/** True when all S3 env vars are present (lets callers degrade gracefully). */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET,
  );
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extForContentType(contentType: string): string {
  return EXT_BY_TYPE[contentType.toLowerCase()] ?? "bin";
}

/** Collision-resistant object key under a folder prefix. */
export function buildObjectKey(prefix: string, contentType: string): string {
  const ext = extForContentType(contentType);
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  return `${clean}/${randomUUID()}.${ext}`;
}

export async function uploadImage(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<{ key: string }> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
  return { key: params.key };
}

/** Time-limited GET URL for a private object. Default 1 hour. */
export function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Decode a `data:<type>;base64,<data>` URL into bytes for storage. */
export function parseDataUrl(
  dataUrl: string,
): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? "";
  const bytes = isBase64
    ? Buffer.from(data, "base64")
    : Buffer.from(decodeURIComponent(data), "utf8");
  return { contentType, bytes };
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}

/**
 * Resolve a stored image reference to a usable URL:
 * - null/empty           -> null
 * - http(s) URL          -> returned as-is (stock art / external image)
 * - otherwise (S3 key)   -> presigned GET URL (or null if storage unconfigured)
 */
export async function resolveStoredImageUrl(
  stored: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  if (!isStorageConfigured()) return null;
  try {
    return await getSignedDownloadUrl(stored, expiresInSeconds);
  } catch {
    return null;
  }
}
