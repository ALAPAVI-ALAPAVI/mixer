// Reads an audio file's duration in the browser, before it's uploaded, so
// the server can store it without needing to process the audio itself.
export function getAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    function cleanup(duration) {
      URL.revokeObjectURL(url);
      resolve(duration);
    }

    audio.onloadedmetadata = () => cleanup(audio.duration || 0);
    audio.onerror = () => cleanup(0);
    audio.src = url;
  });
}
