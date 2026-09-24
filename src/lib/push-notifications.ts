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

export interface PushStatus {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  subscribed: boolean
  endpoint: string | null
}

export async function getPushNotificationStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      endpoint: null,
    }
  }

  const permission = Notification.permission
  let subscribed = false
  let endpoint: string | null = null

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      subscribed = true
      endpoint = subscription.endpoint
    }
  } catch (err) {
    console.warn('[Push] Error checking existing subscription:', err)
  }

  return {
    supported: true,
    permission,
    subscribed,
    endpoint,
  }
}

export async function subscribeToWebPush(cityId: string = 'blr'): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Web Push notifications are not supported in this browser.' }
  }

  // Request browser permission
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return {
      success: false,
      message: perm === 'denied'
        ? 'Notifications were blocked in your browser settings. Please allow notifications in site settings.'
        : 'Notification permission was dismissed.',
    }
  }

  try {
    // 1. Fetch public VAPID key from backend
    const { publicKey } = await apiRequest<{ publicKey: string }>('/api/push/vapid-public-key')
    if (!publicKey) {
      return { success: false, message: 'Server did not return a VAPID public key.' }
    }

    const reg = await navigator.serviceWorker.ready
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

    // Show initial test confirmation
    sendBrowserNotification(
      '🌿 AaharSetu Push Notifications Activated',
      'You are now connected to real-time emergency food rescue alerts.'
    )

    return { success: true, message: 'Web Push notifications activated successfully!' }
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
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await apiRequest('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
      })
    }
    return { success: true, message: 'Unsubscribed from push notifications.' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Failed to unsubscribe: ${errMsg}` }
  }
}

export function sendBrowserNotification(title: string, body: string, icon = '/icon.svg') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon,
        badge: icon,
        tag: 'aaharsetu-local-alert',
      })
    } catch {
      // Fallback for mobile browser where Notification() constructor might throw in document context
      navigator.serviceWorker?.ready.then((reg) => {
        reg.showNotification(title, { body, icon, tag: 'aaharsetu-local-alert' })
      })
    }
  }
}

export async function triggerTestPush(cityId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await apiRequest<{ web_push_sent: number; telegram?: { sent?: boolean } }>('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({
        title: '🚨 Urgent Rescue Notice (Test)',
        body: 'Cooked rice & sambar (25 kg) needs dispatch before 22:30 UTC safety threshold.',
        city_id: cityId,
      }),
    })
    // Also trigger local notification for immediate feedback
    sendBrowserNotification(
      '🚨 Urgent Rescue Notice (Test)',
      'Cooked rice & sambar (25 kg) needs dispatch before 22:30 UTC safety threshold.'
    )
    return {
      success: true,
      message: `Test push sent! (${res.web_push_sent} subscribers reached)`,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Test failed: ${errMsg}` }
  }
}
