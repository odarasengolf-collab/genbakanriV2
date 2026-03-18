const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DB_ID = process.env.NOTION_DB_ID || '1fbcb2d0dcd4808aa674d70d3249b2ef';

// 工程状況のカラーマップ（表示用）
const STATUS_COLOR = {
  '完了': 'green', '入荷済み': 'green', '組み立て済み': 'green',
  '未入荷': 'red', '手配書まだ': 'red', 'ガラス未入荷': 'red', '網戸未入荷': 'red',
  '未着手': 'yellow', '組み立てまだ': 'yellow', '仕上げ待ち': 'yellow',
  '工事中': 'blue', '確認中': 'blue',
};

// Notionページのプロパティを整形してフラットなオブジェクトに変換
function formatPage(page) {
  const p = page.properties;

  const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
  const getText  = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || '';
  const getSelect= (prop) => prop?.select?.name || '';
  const getMulti = (prop) => prop?.multi_select?.map(s => s.name) || [];
  const getDate  = (prop) => prop?.date?.start || '';
  const getUrl   = (prop) => prop?.url || '';
  const getCheck = (prop) => prop?.checkbox || false;

  const status = getMulti(p['工程状況']);

  return {
    id: page.id,
    nid: page.id.replace(/-/g, ''),
    title:      getTitle(p['指示書タイトル']),
    client:     getSelect(p['得意先']),
    sales:      getSelect(p['担当営業']),
    status:     status[0] || '',
    statusAll:  status,
    workdate:   getDate(p['作業実施日＆工事開始日']),
    arrivedate: getDate(p['入荷日']),
    workers:    getMulti(p['作業実施者']),
    note:       getText(p['注意点']),
    address:    getText(p['現場簡易住所']),
    mapUrl:     getUrl(p['現場住所']),
    registered: getCheck(p['本登録（AI確認済）']),
  };
}

// 直近2週間＋未完了の案件を全件取得
async function fetchJobs() {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 3);
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const fmt = (d) => d.toISOString().slice(0, 10);

  let results = [];
  let cursor = undefined;

  // 作業日が直近の案件
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        or: [
          // 作業日が直近2週間以内
          {
            and: [
              { property: '作業実施日＆工事開始日', date: { on_or_after: fmt(twoWeeksAgo) } },
              { property: '作業実施日＆工事開始日', date: { on_or_before: fmt(twoWeeksLater) } },
            ]
          },
          // または未入荷・手配書まだなど要対応案件
          { property: '工程状況', multi_select: { contains: '未入荷' } },
          { property: '工程状況', multi_select: { contains: '手配書まだ' } },
          { property: '工程状況', multi_select: { contains: 'ガラス未入荷' } },
          { property: '工程状況', multi_select: { contains: '網戸未入荷' } },
          { property: '工程状況', multi_select: { contains: '引き取り待ち' } },
          // 入荷日が直近2週間
          {
            and: [
              { property: '入荷日', date: { on_or_after: fmt(twoWeeksAgo) } },
              { property: '入荷日', date: { on_or_before: fmt(twoWeeksLater) } },
            ]
          },
        ]
      },
      sorts: [
        { property: '作業実施日＆工事開始日', direction: 'ascending' }
      ],
      page_size: 100,
      start_cursor: cursor,
    });
    results = results.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // 重複除去
  const seen = new Set();
  const unique = results.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  return unique.map(formatPage);
}

// 引き取り案件を取得
async function fetchHikitori() {
  let results = [];
  let cursor = undefined;
  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        or: [
          { property: '作業実施者', multi_select: { contains: '引き取り' } },
          { property: '工程状況', multi_select: { contains: '引き取り待ち' } },
        ]
      },
      sorts: [{ property: '作業実施日＆工事開始日', direction: 'descending' }],
      page_size: 50,
      start_cursor: cursor,
    });
    results = results.concat(res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  const seen = new Set();
  return results
    .filter(p => { if(seen.has(p.id))return false; seen.add(p.id); return true; })
    .map(formatPage);
}

// 工程状況を更新
async function updateStatus(pageId, newStatus) {
  return notion.pages.update({
    page_id: pageId,
    properties: {
      '工程状況': {
        multi_select: [{ name: newStatus }]
      }
    }
  });
}

// 作業日を更新
async function updateWorkdate(pageId, date) {
  return notion.pages.update({
    page_id: pageId,
    properties: {
      '作業実施日＆工事開始日': {
        date: { start: date }
      }
    }
  });
}

// 新規案件を作成
async function createJob(data) {
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
  if (data.mapUrl && data.mapUrl.startsWith('http')) props['現場住所'] = { url: data.mapUrl };
  if (data.note) props['注意点'] = { rich_text: [{ text: { content: data.note } }] };

  return notion.pages.create({
    parent: { database_id: DB_ID },
    properties: props,
  });
}

// メモを追記（ページのコンテンツに追加）
async function addMemo(pageId, sender, text) {
  const now = new Date().toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  return notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        type: 'callout',
        callout: {
          rich_text: [
            { text: { content: `💬 ${sender}（${now}）\n${text}` } }
          ],
          icon: { emoji: '💬' },
          color: 'blue_background',
        }
      }
    ]
  });
}

module.exports = { fetchJobs, fetchHikitori, updateStatus, updateWorkdate, createJob, addMemo, formatPage };
