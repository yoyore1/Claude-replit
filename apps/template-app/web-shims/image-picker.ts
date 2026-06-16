// Web shim for expo-image-picker — uses a hidden <input type=file> so the
// preview can pick (or capture, on mobile browsers) a photo and return a URI,
// plus base64 (via FileReader) when requested.
type Asset = { uri: string; fileName?: string; base64?: string; mimeType?: string };
type Result = { canceled: boolean; assets: Asset[] };

function pick(capture: boolean, wantBase64: boolean): Promise<Result> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve({ canceled: true, assets: [] });
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) (input as any).capture = "environment";
    input.style.display = "none";
    let settled = false;
    const done = (r: Result) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(r);
    };
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return done({ canceled: true, assets: [] });
      if (wantBase64) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          done({
            canceled: false,
            assets: [{ uri: dataUrl, base64: dataUrl.split(",")[1] || "", mimeType: f.type, fileName: f.name }],
          });
        };
        reader.onerror = () => done({ canceled: true, assets: [] });
        reader.readAsDataURL(f);
        return;
      }
      done({ canceled: false, assets: [{ uri: URL.createObjectURL(f), fileName: f.name }] });
    };
    // If the picker is dismissed, no change fires — treat a later window focus as cancel.
    const onFocus = () => setTimeout(() => { window.removeEventListener("focus", onFocus); done({ canceled: true, assets: [] }); }, 800);
    window.addEventListener("focus", onFocus);
    document.body.appendChild(input);
    input.click();
  });
}

export async function requestCameraPermissionsAsync() {
  return { granted: true, status: "granted" } as const;
}
export async function requestMediaLibraryPermissionsAsync() {
  return { granted: true, status: "granted" } as const;
}
export async function launchCameraAsync(opts?: { base64?: boolean }) {
  return pick(true, !!opts?.base64);
}
export async function launchImageLibraryAsync(opts?: { base64?: boolean }) {
  return pick(false, !!opts?.base64);
}
