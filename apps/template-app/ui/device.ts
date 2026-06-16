import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";

/**
 * Device capabilities for generated apps, wrapped in a SIMPLE, safe API so the
 * codegen model can use them correctly (it gets raw Expo APIs wrong). Each works
 * on device (Expo) and in the web preview (browser APIs via web-shims), and each
 * requests permission itself and fails soft (returns null) instead of throwing.
 */

// Foreground notifications need a handler on native; no-op on the web shim.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  } as any);
} catch {
  /* ignore */
}

/** Pick a photo from the library, or capture one (`{ camera: true }`).
 *  Returns the image URI — or a `data:` URL with `{ base64: true }` (ready to pass
 *  to classifyImage). null if denied/cancelled. */
export async function pickImage(opts?: {
  camera?: boolean;
  base64?: boolean;
}): Promise<string | null> {
  try {
    const pickOpts: any = { quality: 0.7 };
    if (opts?.base64) pickOpts.base64 = true;
    let res: any;
    if (opts?.camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
      res = await ImagePicker.launchCameraAsync(pickOpts);
    } else {
      res = await ImagePicker.launchImageLibraryAsync(pickOpts);
    }
    if (res.canceled) return null;
    const asset = res.assets?.[0];
    if (!asset) return null;
    if (opts?.base64) {
      if (!asset.base64) return asset.uri ?? null;
      return `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`;
    }
    return asset.uri ?? null;
  } catch {
    return null;
  }
}

/** Schedule a local reminder/alarm. `at` is a Date or seconds-from-now.
 *  Returns the scheduled id, or null if denied. */
export async function scheduleReminder(opts: {
  title: string;
  body?: string;
  at: Date | number;
}): Promise<string | null> {
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return null;
    const trigger =
      typeof opts.at === "number"
        ? ({ seconds: Math.max(1, Math.round(opts.at)) } as any)
        : (opts.at as any);
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: opts.title, body: opts.body ?? "" },
      trigger,
    });
    return id;
  } catch {
    return null;
  }
}

/** Cancel a reminder by id (best-effort). */
export async function cancelReminder(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Current device location, requested once. `{ coords, error, loading }`. */
export function useLocation(): {
  coords: Coords | null;
  error: string | null;
  loading: boolean;
} {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          if (alive) {
            setError("Location permission denied");
            setLoading(false);
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        if (alive) {
          setCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLoading(false);
        }
      } catch (e: any) {
        if (alive) {
          setError(e?.message || "Location unavailable");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { coords, error, loading };
}

/** Live accelerometer reading (x/y/z in g). Useful for shake/tilt. */
export function useMotion(): { x: number; y: number; z: number } {
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });
  useEffect(() => {
    let sub: any;
    try {
      Accelerometer.setUpdateInterval(200);
      sub = Accelerometer.addListener(setData);
    } catch {
      /* sensor unavailable */
    }
    return () => sub?.remove?.();
  }, []);
  return data;
}
