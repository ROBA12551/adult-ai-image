// download-image.js - 画像ダウンロード処理とダウンロード数カウント

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

    console.log('[DOWNLOAD] Processing download for image:', imageId);

    // 環境変数
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-username';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'anime-gallery-data';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // 画像データを取得
    const imagesUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/images.json`;
    
    let imageData;
    let currentSha;
    
    try {
      const getResponse = await fetch(imagesUrl, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (getResponse.ok) {
        const fileData = await getResponse.json();
        currentSha = fileData.sha;
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        imageData = JSON.parse(content);
      } else {
        // データが存在しない場合
        console.log('[DOWNLOAD] Images data not found');
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            status: 'error', 
            error: 'Image not found'
          })
        };
      }
    } catch (error) {
      console.error('[DOWNLOAD] Failed to fetch images data:', error);
      throw error;
    }

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

    // ダウンロード数を増やす
    image.downloads = (image.downloads || 0) + 1;
    image.lastDownload = new Date().toISOString();

    // GitHubに保存（非同期で行うため、レスポンスを待たない）
    if (GITHUB_TOKEN) {
      updateImageData(GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, imageData, currentSha)
        .catch(err => console.error('[DOWNLOAD] Failed to update stats:', err));
    }

    console.log('[DOWNLOAD] Success - downloads:', image.downloads);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        downloadUrl: image.fullUrl,
        fileName: `${image.character}_${image.id}.jpg`,
        downloads: image.downloads
      })
    };

  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: error.message
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
        message: 'Update download stats',
        content: content,
        sha: sha
      })
    });

    console.log('[UPDATE-STATS] Successfully updated');
  } catch (error) {
    console.error('[UPDATE-STATS] Error:', error);
  }
}