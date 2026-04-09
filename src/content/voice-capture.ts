let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let stream: MediaStream | null = null;

export async function startRecording(): Promise<void> {
  chunks = [];

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start(100); // collect chunks every 100ms
}

export async function stopRecording(): Promise<ArrayBuffer | null> {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return null;

  return new Promise((resolve) => {
    mediaRecorder!.onstop = async () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;

      const blob = new Blob(chunks, { type: mediaRecorder!.mimeType });
      chunks = [];
      const buffer = await blob.arrayBuffer();
      resolve(buffer);
    };

    mediaRecorder!.stop();
  });
}
