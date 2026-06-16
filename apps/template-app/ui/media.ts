import { Platform } from "react-native";
import { useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { apiBase, transcribe } from "./net";

/**
 * Voice in/out for generated apps:
 *  - speak(text)       → text-to-speech (Kokoro), played aloud
 *  - useVoiceInput()   → record the mic and transcribe (Whisper)
 * Works on device (expo-av) and in the web preview (browser audio/MediaRecorder).
 */

/** Speak text aloud. Fails soft (no-op on error). */
export async function speak(text: string): Promise<void> {
  try {
    const r = await fetch(apiBase() + "/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((x) => x.json());
    const audio = r?.audio;
    if (!audio) return;
    if (Platform.OS === "web") {
      await new (globalThis as any).Audio(audio).play().catch(() => {});
    } else {
      const { sound } = await Audio.Sound.createAsync({ uri: audio });
      await sound.playAsync();
    }
  } catch {
    /* ignore */
  }
}

/** Record the mic, then transcribe on stop. `{ recording, start, stop() → text }`. */
export function useVoiceInput(): {
  recording: boolean;
  start: () => Promise<void>;
  stop: () => Promise<string>;
} {
  const [recording, setRecording] = useState(false);
  const webRef = useRef<any>(null);
  const nativeRef = useRef<any>(null);

  async function start() {
    try {
      if (Platform.OS === "web") {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks: BlobPart[] = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => chunks.push(e.data);
        webRef.current = { mr, chunks, stream };
        mr.start();
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        } as any);
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(
          (Audio as any).RecordingOptionsPresets.HIGH_QUALITY,
        );
        await rec.startAsync();
        nativeRef.current = rec;
      }
      setRecording(true);
    } catch {
      /* mic unavailable */
    }
  }

  async function stop(): Promise<string> {
    setRecording(false);
    try {
      if (Platform.OS === "web") {
        const w = webRef.current;
        if (!w) return "";
        const dataUrl: string = await new Promise((res) => {
          w.mr.onstop = () => {
            const fr = new FileReader();
            fr.onload = () => res(String(fr.result));
            fr.readAsDataURL(new Blob(w.chunks, { type: "audio/webm" }));
          };
          w.mr.stop();
        });
        w.stream.getTracks().forEach((t: any) => t.stop());
        return await transcribe(dataUrl);
      }
      const rec = nativeRef.current;
      if (!rec) return "";
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return "";
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });
      return await transcribe(`data:audio/m4a;base64,${b64}`);
    } catch {
      return "";
    }
  }

  return { recording, start, stop };
}
