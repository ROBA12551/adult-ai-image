exports.handler = async () => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const GITHUB_OWNER = process.env.GITHUB_OWNER;
    const GITHUB_REPO = process.env.GITHUB_REPO;

    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/images.json`;
    const res = await fetch(url + `?t=${Date.now()}`);
    const json = await res.json();

    // URL配列 → 画像オブジェクト配列に変換
    const images = json.urls.map((u, i) => ({
      id: `img_${i}`,
      fullUrl: u,
      thumbnail: u,
      downloads: 0
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "success",
        images
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: "error", error: e.message })
    };
  }
};
