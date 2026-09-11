import { AssistantError } from '@/lib/application/assistant-service';
import { beginRequest, checkRateLimit, clientKeyFor, endRequest } from '@/lib/application/assistant-rate-limit';
import { speechTranscriber } from '@/lib/application/container';

const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/ogg',
  'audio/mpeg',
];

/**
 * POST /api/assistant/transcribe — one audio part, transcribed and handed
 * back as plain text. The client enforces the 30s cap by auto-stopping the
 * recording; this only re-checks the size a client cannot lie its way past.
 * The uploaded buffer is never written anywhere — it is discarded with the
 * request once `speechTranscriber.transcribe` returns or throws.
 */
export async function POST(request: Request): Promise<Response> {
  const clientKey = `transcribe:${clientKeyFor(request)}`;
  const correlationId = crypto.randomUUID();

  if (!checkRateLimit(clientKey)) {
    return Response.json(
      { error: 'rate_limited', message: 'Too many voice requests. Wait a moment and try again.' },
      { status: 429 },
    );
  }
  if (!beginRequest(clientKey)) {
    return Response.json(
      { error: 'rate_limited', message: 'A recording is already being transcribed.' },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get('audio');
    if (!(file instanceof File)) {
      return Response.json({ error: 'invalid_request', message: 'No audio was attached.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.toLowerCase().startsWith(prefix))) {
      return Response.json(
        { error: 'unsupported_type', message: 'That recording format is not supported.' },
        { status: 415 },
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'audio_too_large', message: 'That recording is too long.' }, { status: 413 });
    }

    const { text } = await speechTranscriber.transcribe({
      audio: await file.arrayBuffer(),
      mimeType: file.type,
    });

    console.log('Assistant transcribe', { correlationId, outcome: 'ok' });
    return Response.json({ text });
  } catch (error) {
    if (error instanceof AssistantError) {
      console.error('Assistant transcribe', { correlationId, outcome: error.code });
      return Response.json({ error: error.code, message: error.message }, { status: 503 });
    }
    console.error('Assistant transcribe', { correlationId, outcome: 'internal_error' });
    return Response.json({ error: 'internal', message: 'Could not transcribe that recording.' }, { status: 500 });
  } finally {
    endRequest(clientKey);
  }
}
