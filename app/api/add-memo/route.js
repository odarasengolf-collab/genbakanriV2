const { addMemo } = require('../../../lib/notion');

export async function POST(request) {
  try {
    const { pageId, sender, text } = await request.json();
    if (!pageId || !text) return Response.json({ ok: false, error: 'pageId and text required' }, { status: 400 });

    await addMemo(pageId, sender || '不明', text);
    return Response.json({ ok: true });
  } catch (e) {
    console.error('Memo error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
