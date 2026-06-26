import { StrataApp } from "@/components/strata-app";
import { getStrataAppData } from "@/lib/strata-app-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await getStrataAppData();

  return <StrataApp initialData={initialData} />;
}
