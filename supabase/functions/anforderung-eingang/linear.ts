// Die drei Aufrufe gegen Linear (AGE-830): fileUpload, PUT, issueCreate.
//
// Rohes GraphQL statt `@linear/sdk`, wie im Vorbild AGE-781 (callbot): zwei
// Mutationen rechtfertigen keine neue Abhängigkeit im Deno-Lockfile. Der
// Personal API Key geht OHNE „Bearer" in `authorization`.
//
// Jede Antwort wird geprüft statt vertraut. Alles, was nicht die erwartete
// Form hat — HTTP-Fehler, GraphQL-`errors`, `success: false`, Netzfehler,
// Abbruch durch die Frist —, wird zu `LinearFehler`. Der Aufrufer entscheidet,
// was daraus wird (Vermerk bei einer Datei, 502 beim Issue).

export const LINEAR_GRAPHQL = "https://api.linear.app/graphql";

export class LinearFehler extends Error {}

export interface LinearDeps {
  fetch: typeof fetch;
  apiKey: string;
}

const FILE_UPLOAD = `mutation FileUpload($contentType: String!, $filename: String!, $size: Int!) {
  fileUpload(contentType: $contentType, filename: $filename, size: $size) {
    success
    uploadFile { uploadUrl assetUrl headers { key value } }
  }
}`;

const ISSUE_CREATE = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { identifier } }
}`;

async function graphql(
  deps: LinearDeps,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let res: Response;
  let body: { data?: Record<string, unknown>; errors?: unknown };
  try {
    res = await deps.fetch(LINEAR_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: deps.apiKey },
      body: JSON.stringify({ query, variables }),
      signal,
    });
    body = await res.json();
  } catch (e) {
    throw new LinearFehler(`Linear nicht erreichbar: ${e instanceof Error ? e.name : "?"}`);
  }
  if (!res.ok || body?.errors || !body?.data) {
    throw new LinearFehler(`Linear lehnt ab (HTTP ${res.status})`);
  }
  return body.data;
}

export interface Datei {
  mime: string;
  name: string;
  bytes: Uint8Array<ArrayBuffer>;
}

/** Legt eine Datei in Linears Speicher ab und liefert die `assetUrl`. */
export async function ladeHoch(
  deps: LinearDeps,
  datei: Datei,
  signal?: AbortSignal,
): Promise<string> {
  const data = await graphql(deps, FILE_UPLOAD, {
    contentType: datei.mime,
    filename: datei.name,
    size: datei.bytes.byteLength,
  }, signal);
  const upload = (data.fileUpload ?? {}) as {
    success?: boolean;
    uploadFile?: { uploadUrl?: string; assetUrl?: string; headers?: { key: string; value: string }[] };
  };
  const f = upload.uploadFile;
  if (upload.success !== true || !f?.uploadUrl || !f.assetUrl) {
    throw new LinearFehler("fileUpload ohne Upload-Adresse");
  }

  // Erst unsere Standardwerte, dann Linears gelieferte Header per `set`: bei
  // gleichem Namen gewinnt Linears signierter Wert. `Headers` normalisiert die
  // Groß-/Kleinschreibung, eine Doppelung entsteht also nicht.
  const headers = new Headers({
    "content-type": datei.mime,
    "cache-control": "public, max-age=31536000",
  });
  for (const { key, value } of f.headers ?? []) headers.set(key, value);

  let res: Response;
  try {
    res = await deps.fetch(f.uploadUrl, { method: "PUT", headers, body: datei.bytes, signal });
    await res.body?.cancel();
  } catch (e) {
    throw new LinearFehler(`Upload abgebrochen: ${e instanceof Error ? e.name : "?"}`);
  }
  if (!res.ok) throw new LinearFehler(`Upload abgelehnt (HTTP ${res.status})`);
  return f.assetUrl;
}

export interface IssueInput {
  teamId: string;
  projectId: string;
  stateId: string;
  labelIds: string[];
  title: string;
  description: string;
}

/** Legt das Issue an und liefert den Bezeichner, z. B. `AGE-901`. */
export async function legeIssueAn(
  deps: LinearDeps,
  input: IssueInput,
  signal?: AbortSignal,
): Promise<string> {
  const data = await graphql(deps, ISSUE_CREATE, { input }, signal);
  const r = (data.issueCreate ?? {}) as { success?: boolean; issue?: { identifier?: string } };
  if (r.success !== true || typeof r.issue?.identifier !== "string") {
    throw new LinearFehler("issueCreate ohne Bezeichner");
  }
  return r.issue.identifier;
}
