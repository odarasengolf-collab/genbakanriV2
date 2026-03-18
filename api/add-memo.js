const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { pageId, sender, text } = req.body;
    if (!pageId || !text) return res.status(400).json({ ok: false, error: 'pageId and text required' });

    const now = new Date().toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    await notion.blocks.children.append({
      block_id: pageId,
      children: [{
        type: 'callout',
        callout: {
          rich_text: [{ text: { content: `💬 ${sender || '不明'}（${now}）\n${text}` } }],
          icon: { emoji: '💬' },
          color: 'blue_background',
        }
      }]
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
