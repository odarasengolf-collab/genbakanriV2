const { createJob } = require('../../../lib/notion');

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data.title) return Response.json({ ok: false, error: 'title required' }, { status: 400 });

    const page = await createJob(data);
    return Response.json({ ok: true, page_id: page.id, nid: page.id.replace(/-/g, '') });
  } catch (e) {
    console.error('Create error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
