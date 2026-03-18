const { updateStatus, updateWorkdate } = require('../../../lib/notion');

export async function POST(request) {
  try {
    const { pageId, status, workdate } = await request.json();
    if (!pageId) return Response.json({ ok: false, error: 'pageId required' }, { status: 400 });

    if (status) await updateStatus(pageId, status);
    if (workdate) await updateWorkdate(pageId, workdate);

    return Response.json({ ok: true });
  } catch (e) {
    console.error('Update error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
