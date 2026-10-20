import { apiBlob } from "../api";
import type { SpeakerPictureSize } from "../types";

export const SPEAKER_PICTURE_SIZES: {
  value: SpeakerPictureSize;
  label: string;
}[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
  { value: "full", label: "Full" },
];
export function pictureFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const divisor = bytes < 1024 * 1024 ? 1024 : 1024 * 1024;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, useGrouping: false }).format(bytes / divisor)} ${divisor === 1024 ? "KB" : "MB"}`;
}
async function picturePng(url: string): Promise<Blob> {
  const local = new URL(url, window.location.origin);
  if (
    local.origin !== window.location.origin ||
    !local.pathname.startsWith("/api/")
  )
    throw new Error("Only pictures stored on this site can be copied.");
  const original = await apiBlob(local.pathname.slice(4) + local.search);
  if (
    ![
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/x-icon",
    ].includes(original.type)
  )
    throw new Error(
      "Download this older image format or copy its URL instead."
    );
  if (original.type === "image/png") return original;
  const bitmap = await createImageBitmap(original);
  const canvas = document.createElement("canvas");
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("This browser cannot prepare an image for copying.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("The image could not be copied.")),
        "image/png"
      )
    );
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
export async function copySpeakerPicture(url: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
    throw new Error(
      "Image copying is unavailable in this browser. Download the picture or copy its URL instead."
    );
  // Pass a promise immediately to retain the user gesture on browsers such as Safari.
  const png = picturePng(url);
  void png.catch(() => {});
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } catch {
    throw new Error(
      "The image could not be copied. Allow clipboard access, download it, or copy its URL instead."
    );
  }
}
