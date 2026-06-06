import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/server";
import {
  buildObjectKey,
  getSignedDownloadUrl,
  isStorageConfigured,
  uploadImage,
} from "@/lib/storage/s3";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;
const FOLDER_PATTERN = /^[a-z0-9][a-z0-9/_-]{0,39}$/i;

/**
 * Generic image upload to private S3 storage. Returns the object `key` (persist
 * this) plus a short-lived signed `url` for immediate preview.
 *
 * multipart/form-data fields: `file` (image), optional `folder` (default "uploads").
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Image storage is not configured on the server." },
      { status: 503 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 },
    );
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use PNG, JPEG, or WebP." },
      { status: 400 },
    );
  }

  const folderField = form.get("folder");
  const folder =
    typeof folderField === "string" && FOLDER_PATTERN.test(folderField)
      ? folderField
      : "uploads";

  // Scope keys by user so one account can't overwrite another's objects.
  const key = buildObjectKey(`${folder}/${user.id}`, type);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await uploadImage({ key, body, contentType: type });
    const url = await getSignedDownloadUrl(key);
    return NextResponse.json({ key, url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
