/** Runtime full-card URL → separately archived YGOPRODeck art crop URL. */
export function croppedCardImageUrl(imageUrl: string | null): string | null {
  if (imageUrl === null) return null;
  const marker = "/runtime/images/";
  const index = imageUrl.lastIndexOf(marker);
  return index < 0
    ? imageUrl
    : `${imageUrl.slice(0, index)}/runtime/images-cropped/${imageUrl.slice(index + marker.length)}`;
}
