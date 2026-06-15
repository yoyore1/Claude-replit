import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a value as a scannable QR code (data-URL <img>). */
export function QrCode({ value, size = 148 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) return <div className="qr-placeholder" style={{ width: size, height: size }} />;
  return <img className="qr-img" src={src} width={size} height={size} alt="QR code" />;
}
