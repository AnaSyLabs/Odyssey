"use client";
import { useParams } from "next/navigation";
import SampleHexMap from "@/components/SampleHexMap";

export default function DatasetMap() {
  const { id } = useParams<{ id: string }>();
  return <SampleHexMap key={id} datasetKey={id} />;
}
