const crypto = require('crypto');

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.slice(0, 32).map(i => orig[i]).join('');
}

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

let cachedKey = '';

async function getWbiKeys(cookie) {
  try {
    const { data } = await require('axios').get(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        headers: {
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://www.bilibili.com/',
        },
      }
    );
    if (data?.data?.wbi_img) {
      const { img_url, sub_url } = data.data.wbi_img;
      const imgKey = img_url.split('/').pop().split('.')[0];
      const subKey = sub_url.split('/').pop().split('.')[0];
      cachedKey = imgKey + subKey;
      return cachedKey;
    }
  } catch (e) {
    console.error('[WBI] 获取密钥失败:', e.message);
  }
  return cachedKey;
}

function signWbi(params, wbiKey) {
  if (!wbiKey) return params;
  const mixinKey = getMixinKey(wbiKey);
  const sorted = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && k !== 'w_rid' && k !== 'wts')
    .sort();

  const wts = Math.floor(Date.now() / 1000);
  const queryStr = [...sorted.map(k => `${k}=${encodeURIComponent(params[k])}`), `wts=${wts}`].join('&');
  const wRid = md5(queryStr + mixinKey);

  return { ...params, wts, w_rid: wRid };
}

module.exports = { getWbiKeys, signWbi };
