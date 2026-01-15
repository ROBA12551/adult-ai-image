// contact-submit.js - Discord Webhookを使用したお問い合わせフォーム処理

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
    // Discord Webhook URL（環境変数から取得）
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      console.error('[CONTACT] Discord webhook URL not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          status: 'error', 
          error: 'Contact form not configured. Please set DISCORD_WEBHOOK_URL environment variable.'
        })
      };
    }

    // FormDataのパース（multipart/form-dataの場合）
    let formData;
    
    if (event.headers['content-type']?.includes('multipart/form-data')) {
      // マルチパートの場合は簡易パーサーを使用
      formData = await parseMultipartFormSimple(event);
    } else {
      // 通常のJSONの場合
      formData = JSON.parse(event.body);
    }
    
    console.log('[CONTACT] Form submission:', {
      messageType: formData.messageType,
      email: formData.email,
      subject: formData.subject,
      hasFile: !!formData.file
    });

    // バリデーション
    if (!formData.email || !formData.subject || !formData.message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          status: 'error', 
          error: 'Required fields are missing'
        })
      };
    }

    // Emailバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          status: 'error', 
          error: 'Invalid email address'
        })
      };
    }

    // Discord Embedメッセージを作成
    const embed = {
      title: `📧 ${getMessageTypeEmoji(formData.messageType)} New Contact Form Submission`,
      color: getMessageTypeColor(formData.messageType),
      fields: [
        {
          name: '📋 Message Type',
          value: formData.messageType || 'General',
          inline: true
        },
        {
          name: '👤 Name',
          value: formData.name || 'Anonymous',
          inline: true
        },
        {
          name: '📧 Email',
          value: formData.email,
          inline: true
        },
        {
          name: '📝 Subject',
          value: formData.subject,
          inline: false
        },
        {
          name: '💬 Message',
          value: formData.message.length > 1000 
            ? formData.message.substring(0, 1000) + '...' 
            : formData.message,
          inline: false
        }
      ],
      footer: {
        text: 'AnimeGallery Contact Form'
      },
      timestamp: new Date().toISOString()
    };

    // ファイル情報があれば追加
    if (formData.file) {
      embed.fields.push({
        name: '📎 Attachment',
        value: `File: ${formData.file.filename}\nSize: ${formatFileSize(formData.file.size)}\nType: ${formData.file.mimeType}`,
        inline: false
      });
    }

    // Discord Webhookペイロード
    const webhookPayload = {
      username: 'AnimeGallery Contact',
      avatar_url: 'https://via.placeholder.com/128/ff69b4/ffffff?text=AG',
      embeds: [embed]
    };

    // Discordに送信
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    console.log('[CONTACT] Successfully sent to Discord');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        message: 'Your message has been sent successfully!'
      })
    };

  } catch (error) {
    console.error('[CONTACT] Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: 'Failed to submit contact form. Please try again later.'
      })
    };
  }
};

// 簡易的なマルチパートフォームパーサー
function parseMultipartFormSimple(event) {
  return new Promise((resolve, reject) => {
    try {
      const body = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      const boundary = contentType.split('boundary=')[1];
      
      if (!boundary) {
        return reject(new Error('No boundary found'));
      }

      const parts = body.split(`--${boundary}`);
      const formData = {};

      parts.forEach(part => {
        if (!part || part === '--\r\n' || part === '--') return;

        const [headerSection, ...bodyParts] = part.split('\r\n\r\n');
        if (!headerSection) return;

        const nameMatch = headerSection.match(/name="([^"]+)"/);
        if (!nameMatch) return;

        const fieldName = nameMatch[1];
        const fieldValue = bodyParts.join('\r\n\r\n').trim().replace(/\r\n--$/, '');

        // ファイルの場合
        const filenameMatch = headerSection.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          const contentTypeMatch = headerSection.match(/Content-Type: ([^\r\n]+)/);
          formData.file = {
            filename: filenameMatch[1],
            mimeType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
            size: Buffer.byteLength(fieldValue),
            data: fieldValue
          };
        } else {
          formData[fieldName] = fieldValue;
        }
      });

      resolve(formData);
    } catch (error) {
      reject(error);
    }
  });
}

// メッセージタイプの絵文字
function getMessageTypeEmoji(type) {
  const emojis = {
    'general': '💬',
    'support': '🛠️',
    'dmca': '⚖️',
    'feedback': '💡',
    'bug': '🐛',
    'partnership': '🤝',
    'other': '📌'
  };
  return emojis[type] || '📧';
}

// メッセージタイプの色
function getMessageTypeColor(type) {
  const colors = {
    'general': 0x5865F2,      // ブルー
    'support': 0xFEE75C,      // イエロー
    'dmca': 0xED4245,         // レッド
    'feedback': 0x57F287,     // グリーン
    'bug': 0xEB459E,          // ピンク
    'partnership': 0x5865F2,  // ブルー
    'other': 0x99AAB5         // グレー
  };
  return colors[type] || 0xFF69B4;
}

// ファイルサイズフォーマット
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}