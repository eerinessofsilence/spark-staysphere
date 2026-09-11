import type { SpeechTranscriber } from '../domain/ports';

/**
 * Swappable in one place. `gpt-4o-mini-transcribe` is OpenAI's current
 * low-cost transcription tier and is confirmed active at
 * developers.openai.com/api/docs/models/gpt-4o-mini-transcribe — verified,
 * not assumed from memory. Re-check before rolling this forward.
 */
export const ASSISTANT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * The endpoint sniffs the container from the filename, not just the
 * `Content-Type` header, so this has to match what the browser actually
 * recorded: Opus in a WebM box on Chrome/Firefox, AAC in an MP4 box on
 * Safari.
 */
function filenameFor(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'speech.m4a';
  if (type.includes('wav')) return 'speech.wav';
  if (type.includes('ogg')) return 'speech.ogg';
  return 'speech.webm';
}

interface TranscriptionResponse {
  text?: unknown;
}

export function createOpenAiTranscriber(apiKey: string): SpeechTranscriber {
  return {
    async transcribe({ audio, mimeType, language }) {
      const blob = audio instanceof Blob ? audio : new Blob([audio], { type: mimeType });
      const body = new FormData();
      body.append('file', blob, filenameFor(mimeType));
      body.append('model', ASSISTANT_TRANSCRIBE_MODEL);
      if (language) body.append('language', language);

      const response = await fetch(`${OPENAI_BASE_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}` },
        body,
      });

      if (!response.ok) {
        // Never log the body: a transcription request carries the guest's own audio/text.
        throw new Error(`OpenAI transcription request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as TranscriptionResponse;
      if (typeof payload.text !== 'string') {
        throw new Error('OpenAI transcription returned no text.');
      }
      return { text: payload.text };
    },
  };
}
