import DrawClient from './draw-client';

interface DrawPageProps {
  params: {
    drawId: string;
  };
}

export default function DrawPage({ params }: DrawPageProps) {
  return <DrawClient drawId={params.drawId} />;
}

export async function generateMetadata({ params }: DrawPageProps) {
  return {
    title: `Draw: ${params.drawId} | LuckyDraw`,
  };
}
