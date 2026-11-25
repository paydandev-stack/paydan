import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { viewer, type Viewer } from "@/server/http";

export async function requireVendorPage(): Promise<Viewer> {
  const user = await viewer(await headers());
  if (!user || user.role !== "Vendor" || !user.vendorId)
    redirect("/vendor/login?next=/vendor");
  return user;
}
