import { AudioItem } from '../types';

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.m4a',
  '.aac',
  '.opus',
  '.weba',
  '.wma',
];

export const AUDIO_INPUT_ACCEPT =
  'audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.weba,.wma';

/**
 * Checks if a file is an audio file by extension or MIME type
 */
export function isAudioFile(file: File): boolean {
  if (file.type && file.type.startsWith('audio/')) {
    return true;
  }
  const name = file.name.toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Extract audio duration asynchronously in milliseconds
 */
export function getAudioDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          URL.revokeObjectURL(url);
        }
      };

      audio.onloadedmetadata = () => {
        const d = audio.duration;
        cleanup();
        resolve(isFinite(d) && d > 0 ? Math.round(d * 1000) : 0);
      };

      audio.onerror = () => {
        cleanup();
        resolve(0);
      };

      // Fallback timeout
      setTimeout(() => {
        cleanup();
        resolve(0);
      }, 3000);
    } catch {
      resolve(0);
    }
  });
}

/**
 * Parse clean title, artist, and album from filename and relative path
 */
export function parseAudioMetadata(file: File): {
  title: string;
  artist: string;
  album: string;
} {
  // Strip extension
  let baseName = file.name.replace(/\.[^/.]+$/, '').trim();

  // Strip leading track numbers like "01. ", "01 - ", "01 ", "(01) ", "[01] "
  baseName = baseName.replace(/^[0-9]+[\s.\-_)]+/, '').trim();

  let artist = 'Local Artist';
  let title = baseName;
  let album = 'Local Audio';

  // Check for "Artist - Title" format
  if (baseName.includes(' - ')) {
    const parts = baseName.split(' - ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  } else if (baseName.includes(' – ')) {
    // en-dash
    const parts = baseName.split(' – ');
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' – ').trim();
    }
  }

  // Extract album/folder name from relative path if available
  const relativePath = (file as unknown as { webkitRelativePath?: string })
    .webkitRelativePath;
  if (relativePath && relativePath.includes('/')) {
    const segments = relativePath.split('/');
    if (segments.length >= 2) {
      // The direct parent folder can be the album or artist folder
      album = segments[segments.length - 2];
      if (segments.length >= 3 && artist === 'Local Artist') {
        artist = segments[segments.length - 3];
      }
    }
  }

  return {
    title: title || file.name,
    artist: artist || 'Local Artist',
    album: album || 'Local Audio',
  };
}

/**
 * Parse an individual File into an AudioItem
 */
export async function parseAudioFile(
  file: File,
  index = 0
): Promise<AudioItem> {
  const { title, artist, album } = parseAudioMetadata(file);
  const duration = await getAudioDurationMs(file);
  const uri = URL.createObjectURL(file);

  return {
    id: `local_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    artist,
    album,
    duration,
    uri,
    addedDate: Date.now(),
  };
}

/**
 * Recursively extracts all files from a directory entry (for drag & drop folder support)
 */
async function readEntriesRecursively(
  entry: FileSystemEntry
): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (file) => resolve(isAudioFile(file) ? [file] : []),
        () => resolve([])
      );
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const files: File[] = [];

    const readBatch = async (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(
          (entries) => resolve(entries || []),
          () => resolve([])
        );
      });
    };

    let batch = await readBatch();
    while (batch.length > 0) {
      for (const childEntry of batch) {
        const nestedFiles = await readEntriesRecursively(childEntry);
        files.push(...nestedFiles);
      }
      batch = await readBatch();
    }

    return files;
  }
  return [];
}

/**
 * Extract files from DragEvent's dataTransfer supporting both individual files and dropped folders
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<File[]> {
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const collectedFiles: File[] = [];
    const promises: Promise<File[]>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          promises.push(readEntriesRecursively(entry));
        } else {
          const f = item.getAsFile();
          if (f && isAudioFile(f)) {
            collectedFiles.push(f);
          }
        }
      }
    }

    if (promises.length > 0) {
      const results = await Promise.all(promises);
      for (const res of results) {
        collectedFiles.push(...res);
      }
      return collectedFiles;
    }
  }

  // Fallback to dataTransfer.files
  const files: File[] = [];
  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const f = dataTransfer.files[i];
      if (isAudioFile(f)) {
        files.push(f);
      }
    }
  }
  return files;
}

/**
 * Batch import files with progress callback
 */
export async function batchImportAudioFiles(
  files: File[] | FileList,
  onProgress?: (processed: number, total: number) => void
): Promise<AudioItem[]> {
  const rawList: File[] = Array.isArray(files) ? files : Array.from(files);
  const audioFiles = rawList.filter(isAudioFile);

  const items: AudioItem[] = [];
  for (let i = 0; i < audioFiles.length; i++) {
    const item = await parseAudioFile(audioFiles[i], i);
    items.push(item);
    if (onProgress) {
      onProgress(i + 1, audioFiles.length);
    }
  }

  return items;
}
