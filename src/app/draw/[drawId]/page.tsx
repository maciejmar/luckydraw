import DrawClient from './draw-client';

interface DrawPageProps {
  params: {
    drawId: string;
  };
}

export default async function DrawPage({ params }: DrawPageProps) {
  // Await params to unwrap any promise
  const { drawId } = await params;
  return <DrawClient drawId={drawId} />;
}

export async function generateMetadata({ params }: DrawPageProps) {
  const { drawId } = await params;
  return {
    title: `Draw: ${drawId} | LuckyDraw`,
  };
}
