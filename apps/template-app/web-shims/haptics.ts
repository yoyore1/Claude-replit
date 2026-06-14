// Web shim for expo-haptics (no-op; haptics only fire on a real device).
export enum ImpactFeedbackStyle {
  Light = "light",
  Medium = "medium",
  Heavy = "heavy",
}
export enum NotificationFeedbackType {
  Success = "success",
  Warning = "warning",
  Error = "error",
}
export async function selectionAsync(): Promise<void> {}
export async function impactAsync(_?: ImpactFeedbackStyle): Promise<void> {}
export async function notificationAsync(
  _?: NotificationFeedbackType,
): Promise<void> {}
