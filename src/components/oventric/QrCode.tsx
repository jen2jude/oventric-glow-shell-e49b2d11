import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a QR code for any URL, generated fully client-side. */
export function QrCode({
  value,
  size = 168,
  className,
  dark = "#0A0A0B",
  light = "#FFFFFF",
}: {
  value: string;
  size?: number;
  className?: string;
  dark?: string;
  light?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark, light },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size, dark, light]);

  if (!src) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: light, borderRadius: 10 }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      alt="QR code to install the Oventric app"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
