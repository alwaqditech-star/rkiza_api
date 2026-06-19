import {
  getSessionFromCookie,
  type AuthSession,
} from '../../../../lib/auth';
import { getMediaAsset, isMediaScope, type MediaScope } from '../../../../lib/media-storage';

function canAccessMedia(
  scope: MediaScope,
  ownerId: number,
  session: AuthSession,
): boolean {
  if (session.role === 'admin') {
    if (scope === 'admin') {
      return session.id === ownerId;
    }
    return true;
  }

  if (session.role !== 'client') {
    return false;
  }

  if (scope === 'admin') {
    return false;
  }

  return session.id === ownerId;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ scope: string; ownerId: string }> },
) {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { scope, ownerId } = await context.params;
    if (!isMediaScope(scope)) {
      return new Response('Not found', { status: 404 });
    }

    const id = Number(ownerId);
    if (!Number.isInteger(id) || id <= 0) {
      return new Response('Not found', { status: 404 });
    }

    if (!canAccessMedia(scope, id, session)) {
      return new Response('Forbidden', { status: 403 });
    }

    const asset = await getMediaAsset(scope, id);
    if (!asset) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(asset.data, {
      status: 200,
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Error loading media', { status: 500 });
  }
}
