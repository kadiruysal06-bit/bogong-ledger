const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  const storeId = req.query.store_id || 'default';

  // GET - list invoices
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return res.status(200).json(data || []);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST - save invoice
  if (req.method === 'POST') {
    try {
      const { supplier, invoice_date, invoice_number, items, total, store_id } = req.body;
      
      const { data, error } = await supabase
        .from('invoices')
        .insert([{
          store_id: store_id || storeId,
          supplier,
          invoice_date,
          invoice_number,
          items,
          total
        }])
        .select()
        .single();
      
      if (error) throw error;
      return res.status(200).json({ success: true, invoice: data });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
};
