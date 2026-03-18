const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID || '1fbcb2d0dcd4808aa674d70d3249b2ef';

function formatPage(page) {
  const p = page.properties;
  const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
  const getText  = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || '';
  const getSelect= (prop) => prop?.select?.name || '';
  const getMulti = (prop) => prop?.multi_select?.map(s => s.name) || [];
  const getDate  = (prop) => prop?.date?.start || '';
  const getUrl   = (prop) => prop?.url || '';
  const status = getMulti(p['工程状況']);
  return {
    id: page.id,
    nid: page.id.replace(/-/g, ''),
    title:      getTitle(p['指示書タイトル']),
    client:     getSelect(p['得意先']),
    sales:      getSelect(p['担当営業']),
    status:     status[0] || '',
    workdate:   getDate(p['作業実施日＆工事開始日']),
    arrivedate: getDate(p['入荷日']),
    workers:    getMulti(p['作業実施者']),
    note:       getText(p['注意点']),
    address:    getText(p['現場簡易住所']),
    mapUrl:     getUrl(p['現場住所']),
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const type = req.query.type || 'jobs';

  try {
    const now = new Date();
    const past = new Date(now); past.setDate(past.getDate() - 3);
    const future = new Date(now); future.setDate(future.getDate() + 14);
    const fmt = (d) => d.toISOString().slice(0, 10);

    let filter;
    if (type === 'hikitori') {
      filter = {
        or: [
          { property: '作業実施者', multi_select: { contains: '引き取り' } },
          { property: '工程状況', multi_select: { contains: '引き取り待ち' } },
        ]
      };
    } else {
      filter = {
        or: [
          { and: [
            { property: '作業実施日＆工事開始日', date: { on_or_after: fmt(past) } },
            { property: '作業実施日＆工事開始日', date: { on_or_before: fmt(future) } },
          ]},
          { property: '工程状況', multi_select: { contains: '未入荷' } },
          { property: '工程状況', multi_select: { contains: '手配書まだ' } },
          { property: '工程状況', multi_select: { contains: 'ガラス未入荷' } },
          { property: '工程状況', multi_select: { contains: '網戸未入荷' } },
          { property: '工程状況', multi_select: { contains: '引き取り待ち' } },
          { and: [
            { property: '入荷日', date: { on_or_after: fmt(past) } },
            { property: '入荷日', date: { on_or_before: fmt(future) } },
          ]},
        ]
      };
    }

    let results = [];
    let cursor = undefined;
    do {
      const r = await notion.databases.query({
        database_id: DB_ID,
        filter,
        sorts: [{ property: '作業実施日＆工事開始日', direction: 'ascending' }],
        page_size: 100,
        start_cursor: cursor,
      });
      results = results.concat(r.results);
      cursor = r.has_more ? r.next_cursor : undefined;
    } while (cursor);

    const seen = new Set();
    const data = results
      .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
      .map(formatPage);

    res.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
