import makeQr from 'qrcode-generator';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** A QR code for `value`, drawn dark-on-light with the standard quiet zone. */
export function QrCode({ value, size, color = '#0F1830', background = '#F6F0E2' }: {
  value: string;
  size: number;
  color?: string;
  background?: string;
}) {
  const { path, count } = useMemo(() => {
    const qr = makeQr(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { path: d, count: n + 8 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} accessibilityLabel="QR">
      <Rect width={count} height={count} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  );
}
