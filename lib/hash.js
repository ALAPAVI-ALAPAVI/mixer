// Computes a SHA-256 hash of a file's contents, used to detect when the same
// audio file is being uploaded twice. Works fully offline (pure browser API).
export async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
