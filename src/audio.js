import { validateSegments } from "./source.js";
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
export async function transcribeAudio(
  file,
  apiKey,
  { signal, offset = 0, language = "", fetcher = fetch } = {},
) {
  if (!apiKey)
    throw new Error("Add your Groq API key in Settings before transcribing.");
  if (!(file instanceof Blob) || !file.size || file.size > MAX_AUDIO_BYTES)
    throw new Error("Choose an audio file under 24 MB.");
  const name = file.name || "recording.webm";
  if (!/\.(wav|mp3|mp4|mpeg|mpga|m4a|ogg|flac|webm)$/i.test(name))
    throw new Error("Choose WAV, MP3, MP4, M4A, OGG, FLAC or WebM audio.");
  if (!Number.isFinite(offset) || offset < 0 || offset > 604800)
    throw new Error("Enter a valid video start time in seconds.");
  const form = new FormData();
  form.append("file", file, name);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (language && !["en", "ur"].includes(language))
    throw new Error("Select auto-detect, English or Urdu.");
  if (language) form.append("language", language);
  form.append("temperature", "0");
  let response;
  try {
    response = await fetcher(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        credentials: "omit",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(120000)])
          : AbortSignal.timeout(120000),
      },
    );
  } catch {
    if (signal?.aborted)
      throw new Error("Transcription cancelled. No transcript was saved.");
    throw new Error(
      "Audio transcription could not reach Groq or timed out. Your existing source is unchanged.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Groq rejected your key. Update it in Settings."
        : response.status === 429
          ? "Groq audio quota reached. Retry later."
          : `Audio transcription failed (${response.status}). Your existing source is unchanged.`,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Groq returned an invalid audio response.");
  }
  const segments = (data.segments || [])
    .filter((s) => typeof s.text === "string" && s.text.trim())
    .filter((s) => !Number.isFinite(s.no_speech_prob) || s.no_speech_prob < 0.8)
    .map((s) => ({ text: s.text, startTime: s.start + offset }));
  if (!segments.length)
    throw new Error("No timestamped speech was detected. Try clearer audio.");
  return validateSegments(segments);
}
export async function recordTabAudio({ onStop, onError, maximumMs = 1800000 }) {
  if (!navigator.mediaDevices?.getDisplayMedia || !globalThis.MediaRecorder)
    throw new Error(
      "Tab recording is unavailable here. Upload an audio file instead.",
    );
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      systemAudio: "exclude",
    });
  } catch {
    throw new Error(
      "Recording was not started. Select the video tab and enable Share tab audio.",
    );
  }
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(
      "No tab audio was shared. Select the video tab and enable Share tab audio.",
    );
  }
  const chunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()), {
      mimeType: "audio/webm;codecs=opus",
    });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Audio recording is unsupported. Upload a file instead.");
  }
  let bytes = 0,
    discarded = false,
    timer;
  const stop = (discard = false) => {
    discarded ||= discard;
    if (recorder.state !== "inactive") recorder.stop();
  };
  recorder.ondataavailable = (e) => {
    if (!e.data.size) return;
    bytes += e.data.size;
    if (bytes > MAX_AUDIO_BYTES) {
      discarded = true;
      stop();
      onError("Recording reached its size limit. Record a shorter section.");
    } else chunks.push(e.data);
  };
  recorder.onerror = () => {
    discarded = true;
    stop();
    onError("Recording failed. Try uploading an audio file.");
  };
  recorder.onstop = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    if (!discarded)
      onStop(new File(chunks, "recording.webm", { type: "audio/webm" }));
  };
  stream
    .getVideoTracks()
    .forEach((t) => t.addEventListener("ended", () => stop()));
  try {
    recorder.start(1000);
    timer = setTimeout(() => stop(), maximumMs);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Audio recorder could not start. Upload a file instead.");
  }
  return { stop: () => stop(), cancel: () => stop(true) };
}
