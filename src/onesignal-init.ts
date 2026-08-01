// OneSignal SDK v16 initialization (moved out of index.html to avoid Vite html-proxy issues)
declare global {
  interface Window {
    OneSignalDeferred?: unknown[];
    OneSignal?: unknown;
  }
}

window.OneSignalDeferred = window.OneSignalDeferred || [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window.OneSignalDeferred as any[]).push(async function (OneSignal: any) {
  const oneSignalAppId = import.meta.env.VITE_ONE_SIGNAL_APP_ID as string | undefined;

  if (!oneSignalAppId) {
    console.warn("[OneSignal] Missing App ID — SDK initialization skipped");
    return;
  }

  if (navigator.serviceWorker) {
    await navigator.serviceWorker.ready;
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
  } catch (error) {
    console.warn("[OneSignal] SDK initialization failed, continuing without push", error);
  }
});

export {};
