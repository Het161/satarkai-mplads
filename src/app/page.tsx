import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect((await getSessionUser()) ? "/dashboard" : "/login");
}
