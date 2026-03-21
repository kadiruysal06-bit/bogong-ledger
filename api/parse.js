const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { imageData, mediaType, isImage } = req.body;
    if (!imageData) return res.status(400).json({ error: 'No image data' });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const content = [];

    if (isImage) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType || 'image/jpeg',
          data: imageData
        }
      });
    }

    content.push({
      type: 'text',
      text: `Parse this invoice and return ONLY valid JSON with no other text or markdown:
{
  "supplier": "supplier name",
  "date": "DD/MM/YYYY",
  "invoice_number": "INV-xxx or empty string",
  "items": [
    {
      "name": "item name",
      "quantity": 1.0,
      "unit": "kg or unit or btl etc",
      "unit_price": 10.00,
      "total": 10.00,
      "category": "produce"
    }
  ],
  "subtotal": 0.00,
  "gst": 0.00,
  "total": 0.00
}

Categories must be one of: produce, meat, dairy, other
All numbers must be numeric (not strings).
Return ONLY the JSON object, nothing else.`
    });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content }]
    });

    const text = message.content[0].text;
    
    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse invoice', raw: text });
    
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch(e) {
    console.error('Parse error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
