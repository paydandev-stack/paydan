import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { viewer } from "@/server/http";

export default async function VendorLoginPage() {
  const user = await viewer(await headers());
  if (user?.role === "Vendor" && user.vendorId) redirect("/vendor");
  return <AuthForm mode="vendor" />;
}
