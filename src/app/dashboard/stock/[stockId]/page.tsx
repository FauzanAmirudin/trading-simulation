import { redirect } from "next/navigation";

export default async function StockRedirect({
  params,
}: {
  params: Promise<{ stockId: string }>;
}) {
  const { stockId } = await params;
  redirect(`/dashboard/trading?stock=${stockId}`);
}
