import { useEffect, useRef } from 'react'

// Module-level flag: survives StrictMode's double-effect invocation
let widgetLoaded = false

export default function TelegramLoginButton({ botName, onAuth }) {
  const containerRef = useRef(null)

  // Keep the callback fresh without touching the widget
  useEffect(() => {
    window.onTelegramAuth = onAuth
    return () => { delete window.onTelegramAuth }
  }, [onAuth])

  // Load the script exactly once
  useEffect(() => {
    if (!botName || !containerRef.current || widgetLoaded) return
    widgetLoaded = true

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botName)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '8')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')

    containerRef.current.appendChild(script)
  }, [botName])

  return <div ref={containerRef} className="flex justify-center" />
}
