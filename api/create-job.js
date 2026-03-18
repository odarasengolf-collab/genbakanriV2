const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID || '1fbcb2d0dcd4808aa674d70d3249b2ef';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const data = req.body;
    if (!data.title) return res.status(400).json({ ok: false, error: 'title required' });

    const props = {
      '指示書タイトル': { title: [{ text: { content: data.title } }] },
      '工程状況': { multi_select: [{ name: data.status || '未着手' }] },
    };
    if (data.client) props['得意先'] = { select: { name: data.client } };
    if (data.sales)  props['担当営業'] = { select: { name: data.sales } };
    if (data.workers?.length) props['作業実施者'] = { multi_select: data.workers.map(w => ({ name: w })) };
    if (data.workdate) props['作業実施日＆工事開始日'] = { date: { start: data.workdate } };
    if (data.arrivedate) props['入荷日'] = { date: { start: data.arrivedate } };
    if (data.address) props['現場簡易住所'] = { rich_text: [{ text: { content: data.address } }] };
    if (data.mapUrl?.startsWith('http')) props['現場住所'] = { url: data.mapUrl };
    if (data.note) props['注意点'] = { rich_text: [{ text: { content: data.note } }] };

    const page = await notion.pages.create({ parent: { database_id: DB_ID }, properties: props });
    res.json({ ok: true, page_id: page.id, nid: page.id.replace(/-/g, '') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
