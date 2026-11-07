import { readMedia } from "@/server/media";
import { failure, viewer } from "@/server/http";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return new Response(null, {
      status: 307,
      headers: {
        Location: await readMedia(
          (await params).id,
          await viewer(request.headers),
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
