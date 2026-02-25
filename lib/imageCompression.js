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
