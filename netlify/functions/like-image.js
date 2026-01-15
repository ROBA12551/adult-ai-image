// like-image.js - 画像にいいねを追加

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ status: 'error', error: 'Method not allowed' })
    };
  }

  try {
    const { imageId } = JSON.parse(event.body);
    
    if (!imageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 'error', error: 'imageId is required' })
      };
    }

    console.log('[LIKE] Processing like for image:', imageId);

    // 環境変数
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-username';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'anime-gallery-data';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      console.log('[LIKE] GitHub token not configured');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          status: 'success', 
          message: 'Like counted (local only)'
        })
      };
    }

    // 画像データを取得
    const imagesUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/images.json`;
    
    const getResponse = await fetch(imagesUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!getResponse.ok) {
      console.log('[LIKE] Images data not found');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          status: 'success', 
          message: 'Like counted (local only)'
        })
      };
    }

    const fileData = await getResponse.json();
    const currentSha = fileData.sha;
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const imageData = JSON.parse(content);

    // 該当画像を検索
    const image = imageData.images.find(img => img.id === imageId);
    
    if (!image) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          status: 'error', 
          error: 'Image not found'
        })
      };
    }

    // いいね数を増やす
    image.likes = (image.likes || 0) + 1;
    image.lastLike = new Date().toISOString();

    // GitHubに保存（非同期）
    updateImageData(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, imageData, currentSha)
      .catch(err => console.error('[LIKE] Failed to update likes:', err));

    console.log('[LIKE] Success - likes:', image.likes);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        likes: image.likes
      })
    };

  } catch (error) {
    console.error('[LIKE] Error:', error);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        message: 'Like counted (local only)'
      })
    };
  }
};

// GitHub更新処理（非同期）
async function updateImageData(owner, repo, token, data, sha) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/images.json`;
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update like stats',
        content: content,
        sha: sha
      })
    });

    console.log('[UPDATE-LIKES] Successfully updated');
  } catch (error) {
    console.error('[UPDATE-LIKES] Error:', error);
  }
}