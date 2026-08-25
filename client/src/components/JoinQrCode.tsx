import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface JoinQrCodeProps {
  value: string
  size?: number
}

/** Renders a scannable QR code (as a data URL) for a lobby join link. */
function JoinQrCode({ value, size = 160 }: JoinQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setDataUrl(url) })
      .catch(() => { if (!cancelled) setDataUrl(null) })
    return () => { cancelled = true }
  }, [value, size])

  if (!dataUrl) {
    return <div className="brutal-panel bg-white" style={{ width: size, height: size }} />
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code to join the lobby"
      className="brutal-panel bg-white p-2"
    />
  )
}

export default JoinQrCode
