// get-images.js - 画像一覧を取得するNetlify Function

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 環境変数から画像データの取得元を設定
    const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-username';
    const GITHUB_REPO = process.env.GITHUB_REPO || 'anime-gallery-data';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    
    // GitHub から画像メタデータJSONを取得
    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/images.json`;
    
    console.log('[GET-IMAGES] Fetching from:', url);
    
    const response = await fetch(url + `?t=${Date.now()}`, {
      headers: GITHUB_TOKEN ? {
        'Authorization': `token ${GITHUB_TOKEN}`
      } : {}
    });

    if (!response.ok) {
      // ファイルが存在しない場合はダミーデータを返す
      console.log('[GET-IMAGES] File not found, returning sample data');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          images: generateSampleImages(),
          total: 50,
          message: 'Sample data - configure GitHub repository'
        })
      };
    }

    const data = await response.json();
    
    console.log('[GET-IMAGES] Success - images loaded:', data.images?.length || 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        images: data.images || [],
        total: data.images?.length || 0,
        lastUpdate: data.lastUpdate || new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('[GET-IMAGES] Error:', error);
    
    // エラー時もサンプルデータを返す
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        images: generateSampleImages(),
        total: 50,
        error: error.message
      })
    };
  }
};

// サンプル画像データ生成
function generateSampleImages() {
  const characters = [
    'Rei Ayanami', 'Asuka Langley', 'Misato Katsuragi', 
    'Miku Hatsune', 'Rem', 'Ram', '2B', 'Zero Two',
    'Sakura', 'Mai Sakurajima', 'Megumin', 'Aqua'
  ];
  
  const series = [
    'Evangelion', 'Vocaloid', 'Re:Zero', 'NieR:Automata',
    'Darling in the Franxx', 'Fate', 'Bunny Girl Senpai', 'KonoSuba'
  ];
  
  const tags = [
    'anime', 'manga', 'HD', 'wallpaper', 'illustration', 
    'fan art', 'cute', 'sexy', 'bikini', 'school uniform',
    'maid', 'swimsuit', '4K', 'digital art', 'original'
  ];

  const images = [];
  
  for (let i = 1; i <= 50; i++) {
    const character = characters[Math.floor(Math.random() * characters.length)];
    const serie = series[Math.floor(Math.random() * series.length)];
    const selectedTags = [];
    
    // ランダムに3-5個のタグを選択
    const tagCount = Math.floor(Math.random() * 3) + 3;
    for (let j = 0; j < tagCount; j++) {
      const tag = tags[Math.floor(Math.random() * tags.length)];
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }
    
    images.push({
      id: `img_${i.toString().padStart(4, '0')}`,
      title: `${character} - ${serie} #${i}`,
      character: character,
      series: serie,
      thumbnail: `https://via.placeholder.com/400x600/ff69b4/ffffff?text=${encodeURIComponent(character)}`,
      fullUrl: `https://via.placeholder.com/1920x2880/ff69b4/ffffff?text=${encodeURIComponent(character)}`,
      size: Math.floor(Math.random() * 5000000) + 1000000, // 1-6MB
      quality: Math.random() > 0.3 ? 'HD' : 'Standard',
      downloads: Math.floor(Math.random() * 10000),
      likes: Math.floor(Math.random() * 5000),
      uploadDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      tags: selectedTags,
      adult: true,
      nsfw: Math.random() > 0.5
    });
  }
  
  return images;
}