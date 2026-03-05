import imageCompression from 'browser-image-compression';

/**
 * Compress image before upload
 * Target: under 200KB
 */
export async function compressImage(file, maxSizeKB = 200) {
  // Skip if already small
  if (file.size <= maxSizeKB * 1024) return file;

  const options = {
    maxSizeMB: maxSizeKB / 1024,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  try {
    const compressed = await imageCompression(file, options);
    console.log(
      `Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`
    );
    return compressed;
  } catch (err) {
    console.error('Compression failed, using original:', err);
    return file;
  }
}

/**
 * Compress file for upload — handles both images and non-images (PDF, etc.).
 * Non-image files are returned as-is without compression.
 * @param {File} file - The file to compress
 * @param {number} maxSizeKB - Target max size in KB (default: 300KB)
 * @returns {Promise<File>} - Compressed file (or original if non-image/already small)
 */
export async function compressFileForUpload(file, maxSizeKB = 300) {
  // Skip non-image files (PDF, etc.)
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return compressImage(file, maxSizeKB);
}
