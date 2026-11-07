import { readMedia } from "@/server/media";
import { failure, viewer } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const media = await readMedia(
      (await params).id,
      await viewer(request.headers),
    );
    return new Response(null, {
      status: 307,
      headers: {
        Location: media.url,
        "Cache-Control": media.cacheControl,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
