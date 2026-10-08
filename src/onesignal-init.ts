// OneSignal SDK v16 initialization (moved out of index.html to avoid Vite html-proxy issues)


window.OneSignalDeferred = window.OneSignalDeferred || [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window.OneSignalDeferred as any[]).push(async function (OneSignal: any) {
  const oneSignalAppId = import.meta.env.VITE_ONE_SIGNAL_APP_ID as string | undefined;

  if (!oneSignalAppId) {
    console.warn("[OneSignal] Missing App ID — SDK initialization skipped");
    return;
  }

  // Never block OneSignal forever on the app worker: `ready` only resolves once
  // some worker controls this scope, which may never happen on some phones.
  if (navigator.serviceWorker) {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  }

  try {
    await OneSignal.init({
      appId: oneSignalAppId,
      serviceWorkerParam: { scope: "/push/onesignal/" },
      serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
      notifyButton: { enable: false },
      promptOptions: { slidedown: { enabled: false } },
      autoRegister: false,
      autoResubscribe: true,
      ...(import.meta.env.DEV && { allowLocalhostAsSecureOrigin: true }),
    });
    window.OneSignal = OneSignal;
    console.log("[OneSignal] SDK v16 initialized");

    // Listen for badge updates from the service worker and apply them to the app icon.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "UPDATE_APP_BADGE") {
          const count = typeof event.data.count === "number" ? event.data.count : 0;
          if ("setAppBadge" in navigator) {
            navigator.setAppBadge(count).catch(() => {});
          }
        }
      });
    }

    // Clear the badge when the app is opened.
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch (error) {
    console.warn("[OneSignal] SDK initialization failed, continuing without push", error);
  }
});


export {};
