import { apiRequest } from '@/src/api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isDesktopBrowser(): boolean {
  if (typeof window === 'undefined') return false
  return !/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
}

export function playRescueAlertChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    // Crisp two-tone rescue emergency chime: D5 (587Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.45)
  } catch {
    // Blocked if no user gesture yet
  }
}

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported in this browser')
  }
  let reg = await navigator.serviceWorker.getRegistration()
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  }
  return navigator.serviceWorker.ready
}

export interface PushStatus {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  endpoint: string | null
  isDesktop: boolean
}

export async function getPushNotificationStatus(): Promise<PushStatus> {
  const isDesktop = isDesktopBrowser()
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      endpoint: null,
      isDesktop,
    }
  }

  const permission = Notification.permission
  let subscribed = false
  let endpoint: string | null = null

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        subscribed = true
        endpoint = subscription.endpoint
      }
    }
  } catch (err) {
    console.warn('[Push] Error checking existing subscription:', err)
  }

  return {
    supported: true,
    permission,
    subscribed,
    endpoint,
    isDesktop,
  }
}

export async function subscribeToWebPush(cityId: string = 'blr'): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Web Push notifications are not supported in this browser.' }
  }

  // Request browser/system notification permission
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return {
      success: false,
      message: perm === 'denied'
        ? 'Notifications were blocked in your desktop browser settings. Please allow notifications for this site.'
        : 'Notification permission was dismissed.',
    }
  }

  try {
    // 1. Fetch public VAPID key from backend
    const { publicKey } = await apiRequest<{ publicKey: string }>('/api/push/vapid-public-key')
    if (!publicKey) {
      return { success: false, message: 'Server did not return a VAPID public key.' }
    }

    const reg = await getOrRegisterSW()
    let subscription = await reg.pushManager.getSubscription()

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(publicKey)
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      })
    }

    // 2. Register subscription with backend
    await apiRequest('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        city_id: cityId,
      }),
    })

    // Play chime and show initial confirmation
    playRescueAlertChime()
    sendBrowserNotification(
      '🌿 AaharSetu Desktop Alerts Activated',
      'Your desktop is connected. Real-time emergency food rescues and expiry notices will appear here.'
    )

    return {
      success: true,
      message: isDesktopBrowser()
        ? 'Desktop push notifications & system alerts activated successfully!'
        : 'Web Push notifications activated successfully!',
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[Push] Subscription failed:', err)
    return { success: false, message: `Failed to subscribe: ${errMsg}` }
  }
}

export async function unsubscribeFromWebPush(): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, message: 'Service worker not supported.' }
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await apiRequest('/api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint }),
        })
      }
    }
    return { success: true, message: 'Unsubscribed from push notifications.' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Failed to unsubscribe: ${errMsg}` }
  }
}

export function sendBrowserNotification(title: string, body: string, icon = '/icon.svg') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  playRescueAlertChime()
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon,
        badge: icon,
        tag: 'aaharsetu-desktop-alert',
        silent: false,
      })
    } catch {
      // Fallback for context where direct Notification constructor requires worker
      navigator.serviceWorker?.ready.then((reg) => {
        reg.showNotification(title, { body, icon, tag: 'aaharsetu-desktop-alert' })
      })
    }
  }
}

export async function triggerTestPush(cityId?: string): Promise<{ success: boolean; message: string }> {
  try {
    // Play alert chime
    playRescueAlertChime()

    // Trigger local desktop notification immediately
    sendBrowserNotification(
      '🚨 Urgent Rescue Notice (Desktop Test)',
      'Cooked meals (30 kg) need immediate dispatch before safety window closes at 22:30 UTC.'
    )

    // Also trigger server webpush broadcast
    const res = await apiRequest<{ web_push_sent: number; telegram?: { sent?: boolean } }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({
        title: '🚨 Urgent Rescue Notice (Desktop Test)',
        body: 'Cooked meals (30 kg) need immediate dispatch before safety window closes at 22:30 UTC.',
        city_id: cityId,
      }),
    })

    return {
      success: true,
      message: `Desktop notification triggered! (${res.web_push_sent} subscribers received broadcast)`,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Test failed: ${errMsg}` }
  }
}
