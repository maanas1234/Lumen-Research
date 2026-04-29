/**
 * API utilities for the AI Research Co-Pilot backend.
 */

const BASE = '/api';

export async function uploadPDF(file: File, onProgress?: (pct: number) => void) {
  const form = new FormData();
  form.append('file', file);

  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/upload`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(form);
  });
}

export async function fetchPapers() {
  const r = await fetch(`${BASE}/papers`);
  if (!r.ok) throw new Error('Failed to fetch papers');
  return r.json();
}

export async function fetchPaperStatus(paperId: string) {
  const r = await fetch(`${BASE}/papers/${paperId}/status`);
  if (!r.ok) throw new Error('Failed to fetch paper status');
  return r.json();
}

export async function fetchModels() {
  const r = await fetch(`${BASE}/models`);
  if (!r.ok) return { models: [] };
  return r.json();
}

export async function selectModel(model: string) {
  const r = await fetch(`${BASE}/models/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  return r.json();
}

export async function fetchHealth() {
  const r = await fetch(`${BASE}/health`);
  return r.json();
}

export async function fetchPaperChat(paperId: string) {
  const r = await fetch(`${BASE}/papers/${paperId}/chat`);
  if (!r.ok) throw new Error('Failed to fetch chat history');
  return r.json();
}

export async function deletePaper(paperId: string) {
  await fetch(`${BASE}/papers/${paperId}`, { method: 'DELETE' });
}



/**
 * Stream chat response line by line.
 * onToken: called for each streamed token
 * onSources: called once with source chunks
 * onDone: called when streaming finishes
 */
export async function streamChat(
  paperId: string,
  question: string,
  history: Array<{ role: string; content: string }>,
  mode: string,
  onToken: (t: string) => void,
  onSources: (s: any[]) => void,
  onDone: () => void,
) {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper_id: paperId, question, history, mode }),
  });

  if (!r.ok) throw new Error(await r.text());
  await readEventStream(r, onToken, onSources, onDone);
}

export async function streamExplain(
  action: string,
  text: string,
  onToken: (t: string) => void,
  onDone: () => void,
) {
  const r = await fetch(`${BASE}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, text }),
  });
  if (!r.ok) throw new Error(await r.text());
  await readEventStream(r, onToken, () => {}, onDone);
}

export async function streamSummary(
  paperId: string,
  onToken: (t: string) => void,
  onDone: () => void,
) {
  const r = await fetch(`${BASE}/summary/${paperId}`);
  if (!r.ok) throw new Error(await r.text());
  await readEventStream(r, onToken, () => {}, onDone);
}

export async function createThread(paperId: string, topic: string, mode: string) {
  const r = await fetch(`${BASE}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper_id: paperId, topic, mode }),
  });
  return r.json();
}

export async function streamThreadChat(
  threadId: string,
  question: string,
  mode: string,
  onToken: (t: string) => void,
  onSources: (s: any[]) => void,
  onDone: () => void,
) {
  const r = await fetch(`${BASE}/threads/${threadId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, mode }),
  });
  if (!r.ok) throw new Error(await r.text());
  await readEventStream(r, onToken, onSources, onDone);
}

export async function deleteThread(threadId: string) {
  await fetch(`${BASE}/threads/${threadId}`, { method: 'DELETE' });
}

export async function promoteInsight(threadId: string, insight: string) {
  const r = await fetch(`${BASE}/threads/${threadId}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ insight }),
  });
  return r.json();
}

export async function saveNote(paperId: string, content: string, source?: string, tag?: string) {
  const r = await fetch(`${BASE}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper_id: paperId, content, source, tag }),
  });
  return r.json();
}

export async function fetchNotes(paperId: string) {
  const r = await fetch(`${BASE}/notes/${paperId}`);
  return r.json();
}

export async function deleteNote(paperId: string, noteId: string) {
  await fetch(`${BASE}/notes/${paperId}/${noteId}`, { method: 'DELETE' });
}

// ── Internal helper ──────────────────────────────────────────────────────────
async function readEventStream(
  response: Response,
  onToken: (t: string) => void,
  onSources: (s: any[]) => void,
  onDone: () => void,
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6);
      try {
        const payload = JSON.parse(raw);
        if (payload.type === 'token') onToken(payload.content);
        else if (payload.type === 'sources') onSources(payload.sources ?? []);
        else if (payload.type === 'done') onDone();
      } catch {
        // ignore parse errors
      }
    }
  }
  onDone();
}
