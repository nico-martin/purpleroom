const COVER_UPLOAD_LIMIT = 5 * 1024 * 1024;

/** Prepare a small, orientation-correct 4:1 cover without uploading the original. */
export async function prepareSpeakerCover(file: File): Promise<File> {
  if (!/\.(?:png|jpe?g|webp|avif)$/i.test(file.name)) {
    throw new Error("Choose a PNG, JPEG, WebP or AVIF cover image.");
  }
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Your browser could not read this cover. Try exporting it as PNG or JPEG."
    );
  }
  const canvas = document.createElement("canvas");
  try {
    if (image.width < 800 || image.height < 200) {
      throw new Error(
        "Use a cover at least 800 pixels wide and 200 pixels high. Recommended: 1600 × 400 pixels."
      );
    }
    const cropWidth = Math.min(image.width, image.height * 4);
    const cropHeight = cropWidth / 4;
    canvas.width = Math.floor(Math.min(1600, cropWidth) / 4) * 4;
    canvas.height = canvas.width / 4;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Your browser could not resize this cover. Try a smaller image."
      );
    context.drawImage(
      image,
      (image.width - cropWidth) / 2,
      (image.height - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    // Browsers without WebP encoding fall back to PNG, preserving transparency.
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(
                new Error(
                  "Your browser could not resize this cover. Try a smaller image."
                )
              ),
        "image/webp",
        0.9
      );
    });
    if (blob.size > COVER_UPLOAD_LIMIT)
      throw new Error(
        "The resized cover is still over 5 MB. Try a simpler image."
      );
    return new File(
      [blob],
      `cover.${blob.type === "image/webp" ? "webp" : "png"}`,
      { type: blob.type }
    );
  } finally {
    image.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
