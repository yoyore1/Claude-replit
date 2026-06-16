// Web shim for expo-notifications — uses the browser Notification API. Scheduled
// reminders fire via setTimeout while the preview tab is open (good enough to
// demo the flow; real background delivery is a device/dev-build concern).
export function setNotificationHandler() {
  /* no-op on web */
}

export async function requestPermissionsAsync() {
  try {
    if (typeof Notification === "undefined")
      return { granted: false, status: "denied" } as const;
    const perm =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    return { granted: perm === "granted", status: perm } as const;
  } catch {
    return { granted: false, status: "denied" } as const;
  }
}

const timers: Record<string, any> = {};

export async function scheduleNotificationAsync({
  content,
  trigger,
}: {
  content: { title: string; body?: string };
  trigger: any;
}): Promise<string> {
  const ms =
    trigger && typeof trigger.seconds === "number"
      ? trigger.seconds * 1000
      : trigger instanceof Date
        ? trigger.getTime() - Date.now()
        : 0;
  const id = "n_" + Math.random().toString(36).slice(2, 10);
  timers[id] = setTimeout(
    () => {
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted")
          new Notification(content.title, { body: content.body });
      } catch {
        /* ignore */
      }
      delete timers[id];
    },
    Math.max(0, ms),
  );
  return id;
}

export async function cancelScheduledNotificationAsync(id: string) {
  if (timers[id]) {
    clearTimeout(timers[id]);
    delete timers[id];
  }
}
