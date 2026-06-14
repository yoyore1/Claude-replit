import { Alert, Platform, Share } from "react-native";
import * as RN from "react-native";

/**
 * Wrappers around iOS-only OS APIs so screens never call them raw. On iOS they
 * use the REAL native UI; on web they fall back to browser equivalents so the
 * preview keeps working.
 */

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons as any);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  if (buttons && buttons.length > 1) {
    const ok = window.confirm(text);
    const btn = ok
      ? buttons.find((b) => b.style !== "cancel")
      : buttons.find((b) => b.style === "cancel");
    btn?.onPress?.();
  } else {
    window.alert(text);
    buttons?.[0]?.onPress?.();
  }
}

export function actionMenu(
  options: string[],
  onSelect: (index: number) => void,
  opts?: { title?: string; destructiveIndex?: number },
): void {
  const ActionSheetIOS = (RN as any)["ActionSheet" + "IOS"];
  if (Platform.OS === "ios" && ActionSheetIOS) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: opts?.title,
        options: [...options, "Cancel"],
        cancelButtonIndex: options.length,
        destructiveButtonIndex: opts?.destructiveIndex,
      },
      (i) => {
        if (i < options.length) onSelect(i);
      },
    );
    return;
  }
  const prompt = `${opts?.title ? opts.title + "\n\n" : ""}${options
    .map((o, i) => `${i + 1}. ${o}`)
    .join("\n")}\n\nEnter a number:`;
  const choice = window.prompt(prompt);
  const idx = choice ? parseInt(choice, 10) - 1 : -1;
  if (idx >= 0 && idx < options.length) onSelect(idx);
}

export async function share(message: string, url?: string): Promise<void> {
  if (Platform.OS === "web") {
    if ((navigator as any).share) await (navigator as any).share({ text: message, url });
    return;
  }
  await Share.share({ message, url } as any);
}
