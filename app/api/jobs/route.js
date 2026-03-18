const { fetchJobs, fetchHikitori } = require('../../../lib/notion');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'jobs';

  try {
    if (type === 'hikitori') {
      const data = await fetchHikitori();
      return Response.json({ ok: true, data });
    } else {
      const data = await fetchJobs();
      return Response.json({ ok: true, data });
    }
  } catch (e) {
    console.error('Notion fetch error:', e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
