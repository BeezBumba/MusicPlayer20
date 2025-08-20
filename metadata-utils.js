// Utility functions for extracting song metadata

// Helper: decode a text frame based on its encoding
function decodeTextFrame(buffer, start, length) {
  const encodingByte = new Uint8Array(buffer, start, 1)[0];
  // The text starts after 1 byte indicating encoding.
  const textBytes = new Uint8Array(buffer, start + 1, length - 1);
  let decoder;
  if (encodingByte === 0) {
    // ISO-8859-1 encoding
    decoder = new TextDecoder("iso-8859-1");
  } else if (encodingByte === 1) {
    // UTF-16 with BOM
    decoder = new TextDecoder("utf-16");
  } else if (encodingByte === 2) {
    // UTF-16BE without BOM
    decoder = new TextDecoder("utf-16be");
  } else if (encodingByte === 3) {
    // UTF-8
    decoder = new TextDecoder("utf-8");
  } else {
    // Fallback to ISO-8859-1 if unknown.
    decoder = new TextDecoder("iso-8859-1");
  }
  return decoder.decode(textBytes).replace(/\0/g, "").trim();
}

// Parse the ID3v2 tag from the ArrayBuffer
export function parseID3v2(buffer) {
  const dv = new DataView(buffer);
  // Verify header: Check first 3 bytes for "ID3"
  let tagMark = "";
  for (let i = 0; i < 3; i++){
    tagMark += String.fromCharCode(dv.getUint8(i));
  }
  if (tagMark !== "ID3") {
    return null;
  }

  // Read version (bytes 3-4) and flags (byte 5) if needed.
  const versionMajor = dv.getUint8(3);
  
  // Get tag size (bytes 6-9). These are "sync-safe" integers.
  let tagSize = 0;
  for (let i = 6; i < 10; i++){
    tagSize = (tagSize << 7) | (dv.getUint8(i) & 0x7F);
  }
  // Tag data starts at byte 10 and ends at position (10 + tagSize)
  let pos = 10;
  const end = pos + tagSize;

  // Placeholders for metadata values:
  let title = "", artist = "", album = "";

  // Loop through the frames until we reach the end of the tag.
  // Note: This simple parser assumes ID3v2.3 (or similar) frame formatting.
  while (pos + 10 <= end) {
    // Frame header: 4 bytes for frame ID
    let frameID = "";
    for (let i = 0; i < 4; i++) {
      frameID += String.fromCharCode(dv.getUint8(pos + i));
    }
    // When encountering empty frame IDs, exit the loop.
    if (frameID.trim() === "") {
      break;
    }
    // Frame size (next 4 bytes), big-endian integer.
    const frameSize = dv.getUint32(pos + 4);
    if (frameSize <= 0) {
      break;
    }
    // The frame data starts 10 bytes later.
    const frameDataStart = pos + 10;
    
    // Read and decode the desired frames using a helper function.
    if (frameID === "TIT2") {
      title = decodeTextFrame(buffer, frameDataStart, frameSize);
    } else if (frameID === "TPE1") {
      artist = decodeTextFrame(buffer, frameDataStart, frameSize);
    } else if (frameID === "TALB") {
      album = decodeTextFrame(buffer, frameDataStart, frameSize);
    }

    // Move to the next frame tag.
    pos += 10 + frameSize;
  }

  return { title, artist, album };
}

// Alternatively, check for an ID3v1 tag at the end of the file (last 128 bytes)
export function parseID3v1(buffer) {
  // ID3v1 tags are exactly 128 bytes long and are at the end of the file.
  if (buffer.byteLength < 128) return null;
  const dv = new DataView(buffer);
  const tagStart = buffer.byteLength - 128;
  let tagMark = "";
  for (let i = tagStart; i < tagStart + 3; i++){
    tagMark += String.fromCharCode(dv.getUint8(i));
  }
  if (tagMark !== "TAG") {
    return null;
  }
  // In ID3v1, the text fields have fixed lengths.
  const decoder = new TextDecoder("iso-8859-1");
  const title = decoder.decode(new Uint8Array(buffer, tagStart + 3, 30)).replace(/\0/g, "").trim();
  const artist = decoder.decode(new Uint8Array(buffer, tagStart + 33, 30)).replace(/\0/g, "").trim();
  const album = decoder.decode(new Uint8Array(buffer, tagStart + 63, 30)).replace(/\0/g, "").trim();
  return { title, artist, album };
}

// Extract embedded cover art from MP3 files
export function extractEmbeddedCover(buffer) {
  const dv = new DataView(buffer);
  
  // Check for ID3v2 header
  let tagMark = "";
  for (let i = 0; i < 3; i++){
    tagMark += String.fromCharCode(dv.getUint8(i));
  }
  if (tagMark !== "ID3") {
    return null;
  }

  // Get tag size
  let tagSize = 0;
  for (let i = 6; i < 10; i++){
    tagSize = (tagSize << 7) | (dv.getUint8(i) & 0x7F);
  }
  
  let pos = 10;
  const end = pos + tagSize;

  // Look for APIC frame (attached picture)
  while (pos + 10 <= end) {
    let frameID = "";
    for (let i = 0; i < 4; i++) {
      frameID += String.fromCharCode(dv.getUint8(pos + i));
    }
    
    if (frameID.trim() === "") {
      break;
    }
    
    const frameSize = dv.getUint32(pos + 4);
    if (frameSize <= 0) {
      break;
    }
    
    const frameDataStart = pos + 10;
    
    if (frameID === "APIC") {
      // Parse APIC frame
      const encodingByte = dv.getUint8(frameDataStart);
      let offset = frameDataStart + 1;
      
      // Skip MIME type (null-terminated string)
      while (offset < frameDataStart + frameSize && dv.getUint8(offset) !== 0) {
        offset++;
      }
      offset++; // Skip null terminator
      
      // Skip picture type byte
      offset++;
      
      // Skip description (null-terminated string)
      if (encodingByte === 0 || encodingByte === 3) {
        // ISO-8859-1 or UTF-8
        while (offset < frameDataStart + frameSize && dv.getUint8(offset) !== 0) {
          offset++;
        }
        offset++; // Skip null terminator
      } else {
        // UTF-16
        while (offset < frameDataStart + frameSize - 1 && 
               (dv.getUint8(offset) !== 0 || dv.getUint8(offset + 1) !== 0)) {
          offset += 2;
        }
        offset += 2; // Skip null terminators
      }
      
      // Extract image data
      const imageDataSize = frameSize - (offset - frameDataStart);
      if (imageDataSize > 0) {
        const imageData = new Uint8Array(buffer, offset, imageDataSize);
        const blob = new Blob([imageData]);
        return URL.createObjectURL(blob);
      }
    }
    
    pos += 10 + frameSize;
  }
  
  return null;
}

// Main function to extract metadata
export async function extractSongMetadata(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;

      // First, try to detect an ID3v2 tag.
      let meta = parseID3v2(arrayBuffer);

      // Fall back to ID3v1 if no ID3v2 tag was found.
      if (!meta) {
        meta = parseID3v1(arrayBuffer);
      }

      // If no metadata found, use filename
      if (!meta || (!meta.title && !meta.artist && !meta.album)) {
        const filename = file.name.replace(/\.[^/.]+$/, "");
        const parts = filename.split(/[-–_]/);
        meta = {
          title: parts[parts.length - 1]?.trim() || filename,
          artist: parts.length > 1 ? parts[0].trim() : "Unknown Artist",
          album: ""
        };
      }

      // Extract embedded cover art
      const embeddedCover = extractEmbeddedCover(arrayBuffer);
      meta.embeddedCover = embeddedCover;

      // Attach metadata to the file object
      file.metadata = meta;

      resolve(meta);
    };

    reader.onerror = function () {
      reject(new Error("Error reading file metadata"));
    };

    // Read file as ArrayBuffer so we can handle binary data.
    reader.readAsArrayBuffer(file);
  });
}

// Function to find a matching cover file
export function findMatchingCover(songFile, coverFiles) {
  // Ensure inputs are valid
  if (!songFile || !coverFiles || coverFiles.length === 0) {
    return null;
  }

  // Try to find a matching album name first
  if (songFile.metadata && songFile.metadata.album) {
    // Try to find a cover with the album name (case-insensitive)
    const albumCover = coverFiles.find(coverFile => {
      if (!coverFile) return false;
      const coverName = coverFile.name.replace(/\.[^/.]+$/, "").toLowerCase();
      const albumName = songFile.metadata.album.toLowerCase();
      return coverName === albumName || 
             coverName === `${albumName}.png` || 
             coverName === `${albumName}.jpg` ||
             coverName === `${albumName}.jpeg`;
    });

    if (albumCover) {
      return URL.createObjectURL(albumCover);
    }
  }

  // If no album cover, try to find a cover matching the song name
  const filename = songFile.name.replace(/\.[^/.]+$/, "");
  const matchingCover = coverFiles.find(coverFile => {
    if (!coverFile) return false;
    const coverName = coverFile.name.replace(/\.[^/.]+$/, "").toLowerCase();
    const songName = filename.toLowerCase();
    return coverName === songName || 
           coverName === `${songName}.png` || 
           coverName === `${songName}.jpg` ||
           coverName === `${songName}.jpeg`;
  });

  return matchingCover ? URL.createObjectURL(matchingCover) : null;
}