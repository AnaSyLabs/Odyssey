import { notFound } from "next/navigation";
import HexConsensus from "@/components/HexConsensus";
import { DATASETS } from "@/lib/data";

export const generateStaticParams = () => DATASETS.map(({ id }) => ({ id }));

export default async function DatasetMap({ params }: PageProps<"/mockups/datasets/[id]">) {
  const { id } = await params;
  const dataset = DATASETS.find((d) => d.id === id);
  if (!dataset) notFound();
  return <HexConsensus dataset={dataset} />;
}
