import { getMediaAsset, isMediaScope } from '../../../../lib/media-storage';

export async function GET(
  _request: Request,
  context: { params: Promise<{ scope: string; ownerId: string }> },
) {
  try {
    const { scope, ownerId } = await context.params;
    if (!isMediaScope(scope)) {
      return new Response('Not found', { status: 404 });
    }

    const id = Number(ownerId);
    if (!Number.isInteger(id) || id <= 0) {
      return new Response('Not found', { status: 404 });
    }

    const asset = await getMediaAsset(scope, id);
    if (!asset) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(asset.data, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Error loading media', { status: 500 });
  }
}
