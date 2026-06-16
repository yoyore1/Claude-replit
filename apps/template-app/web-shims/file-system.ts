// Web shim for expo-file-system — only the native path reads recordings as
// base64; on web that's handled via FileReader, so this is a resolve-only stub.
export async function readAsStringAsync(): Promise<string> {
  return "";
}
export const EncodingType = { Base64: "base64", UTF8: "utf8" };
