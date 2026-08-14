/* Browsers reject `requestFullscreen()` outside a user gesture and headless
   runs may not implement it at all, so every call here degrades to `false`
   instead of surfacing a rejection the shell would have to catch again. */

export function isFullscreenSupported(doc: Document): boolean {
  return doc.fullscreenEnabled === true;
}

export function isFullscreen(doc: Document): boolean {
  return doc.fullscreenElement != null;
}

export async function requestAppFullscreen(element: Element): Promise<boolean> {
  if (typeof element.requestFullscreen !== "function") return false;
  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitAppFullscreen(doc: Document): Promise<boolean> {
  if (!isFullscreen(doc) || typeof doc.exitFullscreen !== "function")
    return false;
  try {
    await doc.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}
