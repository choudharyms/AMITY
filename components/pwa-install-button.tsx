import { useState, useEffect } from 'react'
import {
  ArrowDownToLine,
  CheckCircle2,
  Share2,
  PlusSquare,
  Smartphone,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PwaInstallButtonProps {
  variant?: 'small' | 'banner' | 'icon'
  className?: string
}

export function PwaInstallButton({ variant = 'small', className = '' }: PwaInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already running as installed standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      setIsStandalone(isStandaloneMode)
    }

    checkStandalone()

    // Platform detection
    const ua = window.navigator.userAgent.toLowerCase()
    const iosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    const androidDevice = /android/.test(ua)

    setIsIOS(iosDevice)
    setIsAndroid(androidDevice)

    // Capture standard PWA install prompt (Chrome / Android / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
      toast.success('AaharSetu installed to your home screen!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // If already running in standalone mode, show clean installed indicator or null
  if (isStandalone || installed) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium ${className}`}>
        <CheckCircle2 size={12} className="shrink-0" />
        <span className="hidden sm:inline">App Installed</span>
      </div>
    )
  }

  async function handleInstallClick() {
    // On iOS Safari, beforeinstallprompt is not supported. Guide user through Safari Add to Home Screen
    if (isIOS) {
      setShowIOSModal(true)
      return
    }

    // On Android / Desktop Chrome, trigger the native browser install prompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice.outcome === 'accepted') {
          toast.success('Installing AaharSetu…')
          setInstalled(true)
        }
        setDeferredPrompt(null)
      } catch (err) {
        console.error('PWA install error:', err)
      }
    } else {
      // Fallback instruction dialog for browsers that didn't fire event yet
      setShowIOSModal(true)
    }
  }

  return (
    <>
      {/* Small & Elegant Button */}
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`h-8 w-8 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer shadow-xs ${className}`}
          title="Install AaharSetu App on your device"
          aria-label="Install App"
        >
          <ArrowDownToLine size={14} className="shrink-0" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`group h-8 px-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs ${className}`}
          title="Download & install mobile app on Android or iOS"
        >
          <ArrowDownToLine size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:-translate-y-0.5 transition-transform" />
          <span>Get App</span>
          <span className="hidden md:inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </button>
      )}

      {/* Elegant Installation Modal (iOS instructions & browser fallback) */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-md p-6 rounded-3xl bg-card border border-border/80 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#173e2c] border border-emerald-500/30 p-2 flex items-center justify-center shadow-md">
                <img src="/icon.svg" alt="AaharSetu Icon" className="w-full h-full object-contain" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  Install AaharSetu App
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isIOS
                    ? 'Add to iPhone / iPad home screen for instant alerts & full screen'
                    : isAndroid
                    ? 'Install native web app for Android'
                    : 'Install on your computer or mobile device'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs text-foreground">
            {isIOS ? (
              /* iOS Step-by-Step Instructions */
              <div className="space-y-3 bg-muted/40 p-4 rounded-2xl border border-border/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="leading-snug">
                    <p className="font-semibold text-foreground">Tap the Share icon in Safari</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Look for <Share2 size={13} className="inline text-blue-500 mx-1 align-baseline" /> at the bottom of your screen (or top on iPad).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="leading-snug">
                    <p className="font-semibold text-foreground">Scroll & select &quot;Add to Home Screen&quot;</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Tap <PlusSquare size={13} className="inline text-emerald-500 mx-1 align-baseline" /> <strong>Add to Home Screen</strong> in the share menu.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </div>
                  <div className="leading-snug">
                    <p className="font-semibold text-foreground">Confirm &quot;Add&quot;</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Tap <strong>Add</strong> in the top-right corner to launch directly from your home screen.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Android & Desktop Instructions */
              <div className="space-y-3 bg-muted/40 p-4 rounded-2xl border border-border/60">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </div>
                  <div className="leading-snug">
                    <p className="font-semibold text-foreground">Open your browser menu</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      Tap the three vertical dots (<strong>⋮</strong>) in the top-right corner of Chrome or Edge.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </div>
                  <div className="leading-snug">
                    <p className="font-semibold text-foreground">Select &quot;Install app&quot; or &quot;Add to Home screen&quot;</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      AaharSetu will install with offline support and standalone launch.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* App Features Checklist */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Offline route cache</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Zero app-store install</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Instant dispatch alerts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>Full screen experience</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowIOSModal(false)}
              className="text-xs h-8 px-4"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
