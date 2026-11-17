import { z } from "zod";
import { database } from "@/server/db";
import {
  body,
  failure,
  json,
  requireUser,
  sameOrigin,
  viewer,
} from "@/server/http";
import { notificationsFor } from "@/server/notifications";
import { isTestBuyer } from "@/server/test-buyer";
import { put, records } from "@/server/db";
import type { Notification } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await viewer(request.headers);
    requireUser(user);
    return json(
      isTestBuyer(user)
        ? await records<Notification>(database(), "testNotifications", user.id)
        : await notificationsFor(database(), user.id),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await viewer(request.headers);
    requireUser(user);
    const input = z
      .object({ id: z.string().uuid().optional(), all: z.boolean().optional() })
      .refine((value) => value.id || value.all, "Choose a notification.")
      .parse(await body(request));
    if (isTestBuyer(user)) {
      const notifications = await records<Notification>(
        database(),
        "testNotifications",
        user.id,
      );
      for (const notification of notifications) {
        if (input.all || notification.id === input.id)
          await put(
            database(),
            "testNotifications",
            notification.id,
            {
              ...notification,
              readAt: notification.readAt || new Date().toISOString(),
            },
            user.id,
          );
      }
    } else if (input.all)
      await database().query(
        "UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE owner_id=$1",
        [user.id],
      );
    else
      await database().query(
        "UPDATE notification SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND owner_id=$2",
        [input.id, user.id],
      );
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
