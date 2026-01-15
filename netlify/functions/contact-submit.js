// contact-submit.js - Discord Webhookを使用したお問い合わせフォーム処理

const busboy = require('busboy');

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

    // FormDataのパース
    const formData = await parseMultipartForm(event);
    
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

    // Discord Webhookペイロード
    const webhookPayload = {
      username: 'AnimeGallery Contact',
      avatar_url: 'https://via.placeholder.com/128/ff69b4/ffffff?text=AG',
      embeds: [embed]
    };

    // ファイルがある場合
    let fileUploadResult = null;
    if (formData.file) {
      // ファイルサイズチェック（10MB）
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (formData.file.size > MAX_FILE_SIZE) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            status: 'error', 
            error: 'File too large. Maximum size is 10MB.'
          })
        };
      }

      // Discord の場合、8MB以下でないとアップロードできない
      if (formData.file.size <= 8 * 1024 * 1024) {
        // 8MB以下の場合はDiscordに直接アップロード
        try {
          const formDataForDiscord = new FormData();
          const fileBlob = new Blob([formData.file.data], { type: formData.file.mimeType });
          formDataForDiscord.append('file', fileBlob, formData.file.filename);
          formDataForDiscord.append('payload_json', JSON.stringify(webhookPayload));

          const uploadResponse = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            body: formDataForDiscord
          });

          if (uploadResponse.ok) {
            console.log('[CONTACT] File uploaded to Discord successfully');
            fileUploadResult = 'uploaded';
          } else {
            console.error('[CONTACT] Discord file upload failed:', uploadResponse.status);
            fileUploadResult = 'failed';
          }
        } catch (uploadError) {
          console.error('[CONTACT] File upload error:', uploadError);
          fileUploadResult = 'failed';
        }
      } else {
        // 8MB-10MBの場合は、ファイル情報のみ送信
        embed.fields.push({
          name: '📎 Attachment',
          value: `File: ${formData.file.filename}\nSize: ${formatFileSize(formData.file.size)}\n⚠️ File too large for Discord (>8MB). Saved separately.`,
          inline: false
        });
        fileUploadResult = 'too_large';
      }
    }

    // ファイルアップロードが失敗した場合や、8MB以上の場合は、Embedのみ送信
    if (!fileUploadResult || fileUploadResult !== 'uploaded') {
      if (formData.file && fileUploadResult !== 'too_large') {
        embed.fields.push({
          name: '📎 Attachment',
          value: `File: ${formData.file.filename}\nSize: ${formatFileSize(formData.file.size)}`,
          inline: false
        });
      }

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
    }

    console.log('[CONTACT] Successfully sent to Discord');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        message: 'Your message has been sent successfully!',
        fileStatus: fileUploadResult
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

// FormDataパーサー
function parseMultipartForm(event) {
  return new Promise((resolve, reject) => {
    const formData = {};
    
    // base64デコード
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    
    const bb = busboy({ 
      headers: event.headers 
    });

    bb.on('field', (fieldname, val) => {
      formData[fieldname] = val;
    });

    bb.on('file', (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        formData.file = {
          filename: filename,
          mimeType: mimeType,
          encoding: encoding,
          data: Buffer.concat(chunks),
          size: Buffer.concat(chunks).length
        };
      });
    });

    bb.on('finish', () => {
      resolve(formData);
    });

    bb.on('error', (error) => {
      reject(error);
    });

    bb.write(bodyBuffer);
    bb.end();
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