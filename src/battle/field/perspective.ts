// Native WebKit paints nested perspective planes inconsistently. A flat
// camera keeps placement, pointer hit testing and both hand bands in the
// same measured coordinate space on every desktop/mobile webview.
export const FIELD_TILT_DEG = 0;
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
