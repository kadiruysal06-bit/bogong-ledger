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

    var prompt = 'Parse this invoice. Return ONLY a JSON object, no markdown, no backticks, no explanation. Format:\n{"supplier":"name","date":"DD/MM/YYYY","invoice_number":"","items":[{"name":"item","quantity":1,"unit":"kg","unit_price":1.00,"total":1.00,"category":"produce"}],"subtotal":0,"gst":0,"total":0}\nCategories: produce, meat, dairy, other. Numbers must be numeric not strings.';

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
          temperature: 0.1,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
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
      console.error('No candidates:', JSON.stringify(data).substring(0, 300));
      return res.status(500).json({ error: 'No response from Gemini' });
    }

    var text = data.candidates[0].content.parts[0].text || '';

    // Clean response - remove any markdown
    var clean = text.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    clean = clean.replace(/\s*```\s*$/, '').trim();

    // Find JSON object
    var start = clean.indexOf('{');
    var end = clean.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      clean = clean.substring(start, end + 1);
    }

    var parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch(e) {
    console.error('Parse-gemini error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
