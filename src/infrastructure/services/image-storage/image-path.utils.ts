const DEFAULT_EXTENSION = 'jpg';

/** "foo/bar.PNG?x=1" -> "png". Sin extensión reconocible, usa jpg (el formato que entrega el picker por default). */
export function inferImageExtension(sourceUri: string): string {
  const match = sourceUri.match(/\.(\w+)(?:\?.*)?$/);
  return match ? match[1]!.toLowerCase() : DEFAULT_EXTENSION;
}

/** RNFS.copyFile espera un path de archivo plano, no un URI `file://`. */
export function stripFileUriScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}
