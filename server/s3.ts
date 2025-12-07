import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 client configuration
let s3Client: S3Client | null = null;
let bucketName: string | null = null;

export function initializeS3(): boolean {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  bucketName = process.env.AWS_S3_BUCKET;

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    console.warn("AWS S3 credentials not configured. Recording upload functionality will be disabled.");
    return false;
  }

  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log("AWS S3 client initialized successfully");
  return true;
}

export function isS3Configured(): boolean {
  return s3Client !== null && bucketName !== null;
}

// Generate presigned URL for uploading recording
export async function getUploadPresignedUrl(
  userId: string,
  fileName: string,
  contentType: string = "video/webm"
): Promise<{ url: string; key: string } | null> {
  if (!s3Client || !bucketName) {
    console.error("S3 not configured");
    return null;
  }

  // Create a unique key for the recording
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `recordings/${userId}/${timestamp}-${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
    return { url, key };
  } catch (error) {
    console.error("Failed to generate upload presigned URL:", error);
    return null;
  }
}

// Generate presigned URL for downloading recording
export async function getDownloadPresignedUrl(key: string): Promise<string | null> {
  if (!s3Client || !bucketName) {
    console.error("S3 not configured");
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
    return url;
  } catch (error) {
    console.error("Failed to generate download presigned URL:", error);
    return null;
  }
}

// Delete recording from S3
export async function deleteRecordingFromS3(key: string): Promise<boolean> {
  if (!s3Client || !bucketName) {
    console.error("S3 not configured");
    return false;
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Failed to delete recording from S3:", error);
    return false;
  }
}

// Get the public URL for a recording (if bucket is public, otherwise use presigned)
export function getRecordingPublicUrl(key: string): string {
  const region = process.env.AWS_REGION || "us-east-1";
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}
