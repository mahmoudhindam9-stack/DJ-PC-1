export type LyriaModel = 'lyria-3.5' | 'lyria-3-clip-preview';

export interface LyriaGenerationResult {
  model: LyriaModel;
  audioBase64: string;
  mimeType: string;
  lyrics: string;
  generatedAt: string;
}

interface LyriaApiResponse {
  ok: boolean;
  data?: LyriaGenerationResult;
  error?: string;
}

export async function generateLyriaMusic(
  apiKey: string,
  prompt: string,
  model: LyriaModel,
  signal?: AbortSignal,
): Promise<LyriaGenerationResult> {
  const response = await fetch('/api/lyria/generate', {
    method: 'POST',
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, prompt, model }),
  });

  let payload: LyriaApiResponse;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The music service returned an invalid response.');
  }
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error || 'Lyria music generation failed (HTTP ' + response.status + ').');
  }
  return payload.data;
}
