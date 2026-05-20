// Portable JSON export/import for completed interview sessions. Used by
// users to ship their "best" interview to a reviewer (admin), and by
// admins to load that file into the local Inbox for analysis.
//
// Payload is text-only — qaList + transcripts + minimal metadata. No
// audio, no video. The LLM analyzer at openaiAnalysisService.js consumes
// only these text fields, so this is everything required for a re-run.
//
// Envelope shape:
// {
//   version: 1,
//   exportedAt: ISO string,
//   sha256: hex,          // SHA-256 of canonicalized payload — guards
//                         // against accidental edits in transit, not a
//                         // signature (any tamperer can recompute it).
//   payload: { ... }      // see PAYLOAD_FIELDS below
// }

import { INPUT_LIMITS } from '@/constants/inputLimits';

export const EXPORT_VERSION = 1;

// Fields lifted from a stored history entry into the export. Keeping the
// list narrow means we don't accidentally ship unrelated future fields.
const PAYLOAD_FIELDS = [
  'id',
  'savedAt',
  'candidateName',
  'preferredKeywords',
  'difficulty',
  'category',
  'analysisMode',
  'qaList',
  'transcripts',
  'questionTimestamps',
  'completed',
  'llmAnalysis'
];

// Stable JSON: sort object keys recursively so two semantically-equal
// objects produce byte-identical strings (and therefore identical SHA-256).
// Arrays preserve their natural order. Handles primitives, arrays, and
// plain objects — which is all the payload contains.
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = canonicalize(value[k]);
  }
  return out;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function pickPayload(session) {
  const out = {};
  for (const f of PAYLOAD_FIELDS) {
    if (session[f] !== undefined) out[f] = session[f];
  }
  return out;
}

export async function buildExportEnvelope(session) {
  if (!session || !session.id) {
    throw new Error('Cannot export: session has no id.');
  }
  const payload = pickPayload(session);
  const sha256 = await sha256Hex(canonicalStringify(payload));
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sha256,
    payload
  };
}

// Filesystem-safe filename: candidate name + date stamp. Falls back to
// the session id when no candidate name is set.
export function exportFilename(session) {
  const raw = (session.candidateName || '').trim();
  const namePart = raw
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '') || `interview-${session.id || ''}`;
  const datePart = (session.savedAt || new Date().toISOString())
    .slice(0, 10);
  return `${namePart}-${datePart}.interview.json`;
}

const MANIFEST_NAME = 'manifest.json';
const AUDIO_DIR = 'audio/';

// audioItems: [{ idx, blob }]. Empty/missing blobs are skipped.
export async function buildExportZip(session, audioItems = []) {
  const { default: JSZip } = await import('jszip');
  const envelope = await buildExportEnvelope(session);
  const zip = new JSZip();
  zip.file(MANIFEST_NAME, JSON.stringify(envelope, null, 2));
  for (const { idx, blob } of audioItems) {
    if (blob && blob.size) zip.file(`${AUDIO_DIR}${idx}.webm`, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function exportZipFilename(session) {
  return exportFilename(session).replace(/\.json$/, '.zip');
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Returns { payload, audio: [{ idx, blob }] }. Audio is rebuilt as typed webm
// blobs so the transcription upload sends the right format.
export async function parseImportZip(fileOrBuffer) {
  const { default: JSZip } = await import('jszip');
  let zip;
  try {
    zip = await JSZip.loadAsync(fileOrBuffer);
  } catch (e) {
    throw new Error('File is not a valid .zip archive.');
  }
  const manifest = zip.file(MANIFEST_NAME);
  if (!manifest) {
    throw new Error('This .zip is not an interview export (missing manifest.json).');
  }
  const payload = await parseImportEnvelope(await manifest.async('string'));
  const maxIdx = Array.isArray(payload.qaList) ? payload.qaList.length : 0;
  const audio = [];
  const audioFiles = zip.file(new RegExp('^' + AUDIO_DIR + '\\d+\\.webm$'));
  if (audioFiles.length > maxIdx) {
    throw new Error('Export is malformed: more audio files than questions.');
  }
  for (const f of audioFiles) {
    const m = f.name.match(/(\d+)\.webm$/);
    if (!m) continue;
    const idx = Number(m[1]);
    if (idx < 0 || idx >= maxIdx) continue;
    const buf = await f.async('arraybuffer');
    if (buf.byteLength > INPUT_LIMITS.AUDIO_BYTES) {
      throw new Error('Export is malformed: an audio file exceeds the size limit.');
    }
    audio.push({ idx, blob: new Blob([buf], { type: 'audio/webm' }) });
  }
  return { payload, audio };
}

export function triggerJsonDownload(envelope, filename) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Validates an envelope and returns the payload, ready to hand to
// saveImportedSession. Throws a user-readable Error on any problem so
// the caller can surface it in the UI.
export async function parseImportEnvelope(text) {
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch (e) {
    throw new Error('File is not valid JSON.');
  }
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('File is not an interview export.');
  }
  if (envelope.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${envelope.version}. Expected ${EXPORT_VERSION}.`);
  }
  const payload = envelope.payload;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Export envelope is missing its payload.');
  }
  if (!payload.id || typeof payload.id !== 'string') {
    throw new Error('Export payload is missing a session id.');
  }
  if (!Array.isArray(payload.qaList) || payload.qaList.length === 0) {
    throw new Error('Export payload has no questions.');
  }
  if (!Array.isArray(payload.transcripts)) {
    throw new Error('Export payload has no transcripts array.');
  }
  // transcripts.length < qaList.length is legitimate — the user may have
  // stopped the interview early, so only the first N slots are filled.
  // The analyzer maps over qaList and treats missing slots as "no spoken
  // answer". Only reject when transcripts is LONGER than qaList, which
  // would mean the file is structurally broken.
  if (payload.transcripts.length > payload.qaList.length) {
    throw new Error(
      `Malformed export: ${payload.transcripts.length} transcripts for only ${payload.qaList.length} questions.`
    );
  }
  // Integrity check: best-effort. A missing sha256 is allowed (older
  // exports might not include one) but a mismatching one means the file
  // was edited or corrupted in transit — reject it.
  if (typeof envelope.sha256 === 'string' && envelope.sha256.length === 64) {
    const computed = await sha256Hex(canonicalStringify(payload));
    if (computed !== envelope.sha256) {
      throw new Error('File integrity check failed — the file appears to be edited or corrupted.');
    }
  }
  return payload;
}
