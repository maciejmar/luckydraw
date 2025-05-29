import Link from 'next/link';
import { TicketCheck } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-primary shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary-foreground hover:opacity-80 transition-opacity">
          <TicketCheck size={32} />
          <h1 className="text-2xl font-bold">LuckyDraw</h1>
        </Link>
      </div>
    </header>
  );
}
