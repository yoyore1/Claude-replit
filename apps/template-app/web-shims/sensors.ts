// Web shim for expo-sensors — maps the Accelerometer to the browser
// `devicemotion` event (values normalized to g, matching Expo).
type Sample = { x: number; y: number; z: number };

export const Accelerometer = {
  addListener(cb: (s: Sample) => void) {
    const handler = (e: any) => {
      const a = e.accelerationIncludingGravity || e.acceleration || {};
      cb({ x: (a.x || 0) / 9.81, y: (a.y || 0) / 9.81, z: (a.z || 0) / 9.81 });
    };
    if (typeof window !== "undefined")
      window.addEventListener("devicemotion", handler);
    return {
      remove() {
        if (typeof window !== "undefined")
          window.removeEventListener("devicemotion", handler);
      },
    };
  },
  setUpdateInterval(_ms: number) {
    /* browsers fix the devicemotion cadence; no-op */
  },
};
