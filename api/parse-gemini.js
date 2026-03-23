module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    var body = req.body;
    var imageData = body.imageData;
    var mediaType = body.mediaType || 'image/jpeg';
    var isImage = body.isImage !== false;

    if (!imageData) return res.status(400).json({ error: 'No image data' });

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

    // Çok basit prompt - minimal JSON
    var prompt = 'Extract invoice data. Return ONLY valid JSON:\n{"supplier":"","date":"","invoice_number":"","items":[{"name":"","quantity":0,"unit":"","unit_price":0,"total":0,"category":"other"}],"total":0}\nCategories: produce, meat, dairy, other. No trailing commas. No comments.';

    var parts = [];
    if (isImage) {
      parts.push({ inline_data: { mime_type: mediaType, data: imageData } });
    }
    parts.push({ text: prompt });

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      var errText = await response.text();
      console.error('Gemini HTTP error:', response.status, errText.substring(0, 200));
      return res.status(500).json({ error: 'Gemini error: ' + response.status });
    }

    var data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      return res.status(500).json({ error: 'No response from Gemini' });
    }

    var text = data.candidates[0].content.parts[0].text || '';
    console.log('Gemini text length:', text.length);

    // Agresif temizleme
    var clean = text.trim();
    // Backtick blokları kaldır
    clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
    // JSON objesini bul
    var start = clean.indexOf('{');
    var end = clean.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return res.status(500).json({ error: 'No JSON found in response' });
    }
    clean = clean.substring(start, end + 1);

    // Trailing comma düzelt: ,} ve ,] 
    clean = clean.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    var parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch(e) {
    console.error('Parse-gemini error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
