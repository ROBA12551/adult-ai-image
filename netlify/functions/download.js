// netlify/functions/download.js
const ALLOWED_HOSTS = new Set(["holara.ai", "content.holara.ai", "www.holara.ai"]);

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

exports.handler = async (event) => {
  const headers = cors();
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const urlParam = event.queryStringParameters?.url;
    if (!urlParam) {
      return { statusCode: 400, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "url is required" }) };
    }

    const url = new URL(urlParam);
    if (url.protocol !== "https:") throw new Error("https only");
    if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error("host not allowed");

    const upstream = await fetch(url.toString(), { redirect: "follow" });
    if (!upstream.ok) throw new Error(`upstream failed: ${upstream.status}`);

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    // ファイル名をURL末尾から作る
    const filename = (url.pathname.split("/").pop() || "image.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");

    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
      isBase64Encoded: true,
      body: buf.toString("base64"),
    };
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
