import { NextResponse } from "next/server";
import type {
  UploadApiResponse,
  UploadApiErrorResponse,
  UploadApiOptions,
} from "cloudinary";
import { randomUUID } from "crypto";
import { cloudinary } from "@/lib/cloudinary";
import { transliterateBG } from "@/lib/transliterate";

export const runtime = "nodejs";

type UploadType = "player" | "club";

function getUploadOptions(type: UploadType, name: string): UploadApiOptions {
  const slug = transliterateBG(name);
  const folder = type === "player" ? "players" : "clubs";
  const fallbackSlug = `${folder}-${Date.now()}`;
  const shortId = randomUUID().replace(/-/g, "").slice(0, 8);
  const publicId = `${folder}/${slug || fallbackSlug}-${shortId}`;

  if (type === "player") {
    return {
      public_id: publicId,
      format: "webp",
      transformation: [
        {
          width: 640,
          height: 800,
          crop: "limit",
          quality: "auto:good",
        },
      ],
    };
  }

  return {
    public_id: publicId,
    format: "webp",
    transformation: [
      {
        width: 768,
        height: 768,
        crop: "limit",
        quality: "auto:good",
      },
    ],
  };
}

function uploadToCloudinary(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (
        error: UploadApiErrorResponse | undefined,
        result: UploadApiResponse | undefined,
      ) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const typeField = formData.get("type");
    const nameField = formData.get("name");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (typeField !== "player" && typeField !== "club") {
      return NextResponse.json(
        { error: "Invalid type. Expected 'player' or 'club'." },
        { status: 400 },
      );
    }
    if (typeof nameField !== "string" || !nameField.trim()) {
      return NextResponse.json(
        { error: "Missing name for public_id generation." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadResult = await uploadToCloudinary(
      buffer,
      getUploadOptions(typeField, nameField),
    );

    return NextResponse.json({
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
