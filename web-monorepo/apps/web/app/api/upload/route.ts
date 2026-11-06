import { hubState, updateHubFrame } from "@/lib/hub";

export async function POST(req: Request) {
  const devAddr = req.headers.get("x-device-address") || hubState.device_address;
  const seqHeader = req.headers.get("x-frame-seq");
  const seq = seqHeader ? parseInt(seqHeader, 10) : hubState.current_seq + 1;
  const signature = req.headers.get("x-signature") || "UNSIGNED";

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > 0) {
    updateHubFrame(devAddr, seq, signature, buffer);
  }

  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Connection": "keep-alive",
    },
  });
}
