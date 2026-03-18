const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pageId, status, workdate } = req.body;
    if (!pageId) return res.status(400).json({ ok: false, error: 'pageId required' });

    if (status) {
      await notion.pages.update({
        page_id: pageId,
        properties: { '工程状況': { multi_select: [{ name: status }] } }
      });
    }
    if (workdate) {
      await notion.pages.update({
        page_id: pageId,
        properties: { '作業実施日＆工事開始日': { date: { start: workdate } } }
      });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
