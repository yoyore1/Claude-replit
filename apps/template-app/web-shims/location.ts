// Web shim for expo-location — uses the browser Geolocation API.
export async function requestForegroundPermissionsAsync() {
  // The actual permission prompt happens on getCurrentPosition in the browser.
  return { granted: true, status: "granted" } as const;
}

export async function getCurrentPositionAsync(): Promise<{
  coords: { latitude: number; longitude: number; accuracy: number };
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation)
      return reject(new Error("Geolocation unavailable"));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          coords: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
          },
        }),
      (e) => reject(new Error(e.message || "Location error")),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  });
}
