// netlify/functions/download-image.js
const ALLOWED_HOSTS = new Set(["holara.ai", "www.holara.ai"]);

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function safeUrl(u) {
  const url = new URL(u);
  if (url.protocol !== "https:") throw new Error("Only https URLs are allowed");
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error("Host not allowed");
  return url;
}

async function ghGetJson(owner, repo, token, path) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const r = await fetch(api, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  const file = await r.json();
  const content = Buffer.from(file.content, "base64").toString("utf-8");
  return { json: JSON.parse(content), sha: file.sha };
}

async function ghPutJson(owner, repo, token, path, json, sha, message) {
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(json, null, 2)).toString("base64");
  const r = await fetch(api, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, content, sha }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GitHub PUT failed: ${r.status} ${t}`);
  }
}

function filenameFromImage(image) {
  const base = (image.character || image.title || "image")
    .toString()
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 50);
  return `${base}_${image.id}.jpg`;
}

exports.handler = async (event) => {
  const headers = cors();
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET")
    return { statusCode: 405, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "error", error: "Method not allowed" }) };

  try {
    const imageId = event.queryStringParameters?.imageId;
    if (!imageId) {
      return { statusCode: 400, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "error", error: "imageId is required" }) };
    }

    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
      return { statusCode: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "error", error: "Missing GitHub env vars" }) };
    }

    // images.json 読み込み
    const { json, sha } = await ghGetJson(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, "images.json");
    const image = (json.images || []).find((x) => x.id === imageId);
    if (!image) {
      return { statusCode: 404, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: "error", error: "Image not found" }) };
    }

    // 外部URLを安全に検証
    const url = safeUrl(image.fullUrl || image.sourceUrl);

    // 画像を取得（stream→buffer）
    const r = await fetch(url.toString(), { redirect: "follow" });
    if (!r.ok) throw new Error(`Upstream fetch failed: ${r.status}`);

    const contentType = r.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await r.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    // ダウンロード数カウント（ここは同期更新にして確実に反映）
    image.downloads = (image.downloads || 0) + 1;
    image.lastDownload = new Date().toISOString();
    json.lastUpdate = new Date().toISOString();
    await ghPutJson(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, "images.json", json, sha, "Update download stats");

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filenameFromImage(image)}"`,
        "Cache-Control": "no-store",
      },
      isBase64Encoded: true,
      body: body.toString("base64"),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "error", error: e.message }),
    };
  }
};
