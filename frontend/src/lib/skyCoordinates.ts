export interface SkyPosition {
  azimuthDeg: number;
  altitudeDeg: number;
  riseUtc: string;
  setUtc: string;
}

function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function localSiderealDegrees(date: Date, longitudeDeg: number): number {
  const days = julianDate(date) - 2_451_545;
  const gmst = 280.46061837 + 360.98564736629 * days;
  return ((gmst + longitudeDeg) % 360 + 360) % 360;
}

function riseSetUtc(
  raDeg: number,
  decDeg: number,
  latitudeDeg: number,
  longitudeDeg: number,
  date: Date,
  isRise: boolean,
): string {
  const latitude = latitudeDeg * Math.PI / 180;
  const declination = decDeg * Math.PI / 180;
  const horizon = -0.833 * Math.PI / 180;
  const denominator = Math.cos(latitude) * Math.cos(declination);
  if (Math.abs(denominator) < 1e-8) return "—";
  const hourAngleCosine =
    (Math.sin(horizon) - Math.sin(latitude) * Math.sin(declination)) / denominator;
  if (hourAngleCosine < -1 || hourAngleCosine > 1) return "Not rising/setting";
  const hourAngle = Math.acos(hourAngleCosine) * 180 / Math.PI;
  const siderealNow = localSiderealDegrees(date, longitudeDeg);
  const transitDelta = ((raDeg - siderealNow + 540) % 360) - 180;
  let delta = isRise ? transitDelta - hourAngle : transitDelta + hourAngle;
  if (isRise && delta > 0) delta -= 360;
  if (!isRise && delta < 0) delta += 360;
  const estimatedUtc = new Date(date.getTime() + delta / 360.98564736629 * 86_400_000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(estimatedUtc);
}

export function calculateSkyPosition(
  raDeg: number,
  decDeg: number,
  latitudeDeg: number,
  longitudeDeg: number,
  date = new Date(),
): SkyPosition {
  const hourAngle =
    (((localSiderealDegrees(date, longitudeDeg) - raDeg + 540) % 360) - 180) * Math.PI / 180;
  const latitude = latitudeDeg * Math.PI / 180;
  const declination = decDeg * Math.PI / 180;
  const altitude = Math.asin(
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle),
  );
  const azimuth = Math.atan2(
    -Math.sin(hourAngle) * Math.cos(declination),
    Math.sin(declination) * Math.cos(latitude) -
      Math.cos(declination) * Math.sin(latitude) * Math.cos(hourAngle),
  );
  return {
    azimuthDeg: (azimuth * 180 / Math.PI + 360) % 360,
    altitudeDeg: altitude * 180 / Math.PI,
    riseUtc: riseSetUtc(raDeg, decDeg, latitudeDeg, longitudeDeg, date, true),
    setUtc: riseSetUtc(raDeg, decDeg, latitudeDeg, longitudeDeg, date, false),
  };
}
