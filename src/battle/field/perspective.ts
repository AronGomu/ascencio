export const FIELD_TILT_DEG = 20;
export const FIELD_CAMERA_PX = 600;

/** CSS transform for the field plane, or an empty string in flat mode. */
export function fieldPlaneTransform(
  tiltDeg = FIELD_TILT_DEG,
  cameraPx = FIELD_CAMERA_PX,
): string {
  return tiltDeg === 0
    ? ""
    : `perspective(${cameraPx}px) rotateX(${tiltDeg}deg)`;
}
