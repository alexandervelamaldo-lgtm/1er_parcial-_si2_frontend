export type DecodedTextFile = {
  text: string;
  encoding: 'utf-8' | 'windows-1252' | 'iso-8859-1' | 'unknown';
};

function tryDecode(bytes: Uint8Array, encoding: string, fatal = false): string | null {
  try {
    const dec = new TextDecoder(encoding, { fatal });
    return dec.decode(bytes);
  } catch (_) {
    return null;
  }
}

export function decodeTextBytes(bytes: Uint8Array): DecodedTextFile {
  const utf8 = tryDecode(bytes, 'utf-8', true);
  if (utf8 !== null) return { text: utf8, encoding: 'utf-8' };

  const win1252 = tryDecode(bytes, 'windows-1252');
  if (win1252 !== null) return { text: win1252, encoding: 'windows-1252' };

  const latin1 = tryDecode(bytes, 'iso-8859-1');
  if (latin1 !== null) return { text: latin1, encoding: 'iso-8859-1' };

  const fallback = tryDecode(bytes, 'utf-8');
  return { text: fallback ?? '', encoding: 'unknown' };
}

