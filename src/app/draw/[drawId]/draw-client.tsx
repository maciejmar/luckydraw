
'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { fairWinnerSelection, type FairWinnerSelectionInput, type FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';
import ConfettiEffect from '@/components/ConfettiEffect';
import { QrCode, UsersRound, UserPlus, Trophy, PlayCircle, Loader2, AlertTriangle, PartyPopper } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Participant {
  userId: string;
  name: string;
  joinTime: Date;
}

interface DrawClientProps {
  drawId: string;
}

export default function DrawClient({ drawId }: DrawClientProps) {
  const [description, setDescription] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [winner, setWinner] = useState<FairWinnerSelectionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // localStorage is only available on the client
    if (typeof window !== 'undefined') {
      const storedDescription = localStorage.getItem(`drawDescription-${drawId}`);
      if (storedDescription) {
        setDescription(storedDescription);
      } else {
        setDescription('Welcome to the draw!'); // Default description
      }
      setQrCodeValue(window.location.href);
    }
  }, [drawId]);

  const handleAddParticipant = () => {
    if (newParticipantName.trim() === '') {
      toast({ title: 'Error', description: 'Participant name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (participants.find(p => p.name.toLowerCase() === newParticipantName.trim().toLowerCase())) {
      toast({ title: 'Error', description: 'Participant with this name already exists.', variant: 'destructive' });
      return;
    }
    const newParticipant: Participant = {
      userId: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: newParticipantName.trim(),
      joinTime: new Date(),
    };
    setParticipants((prev) => [...prev, newParticipant]);
    setNewParticipantName('');
    toast({ title: 'Participant Added', description: `${newParticipant.name} has joined the draw!` });
  };

  const handleSelectWinner = async () => {
    if (participants.length < 1) { // Allow draw with 1 person, though AI might benefit from more context. For testing, 1 is ok.
      toast({ title: 'Error', description: 'Add at least one participant to start the draw.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setError(null);
    setWinner(null);
    setShowConfetti(false);

    const aiInput: FairWinnerSelectionInput = {
      participants: participants.map(p => ({ userId: p.userId, joinTime: p.joinTime.toISOString() })),
      description: description,
    };

    try {
      const result = await fairWinnerSelection(aiInput);
      setWinner(result);
      setShowConfetti(true);
      toast({ title: 'Winner Selected!', description: 'The lucky winner has been chosen.', className: 'bg-primary text-primary-foreground' });
    } catch (err) {
      console.error('Error selecting winner:', err);
      setError('Failed to select a winner. The AI might be having a moment. Please try again.');
      toast({ title: 'AI Error', description: 'Could not select a winner. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const winnerParticipant = winner ? participants.find(p => p.userId === winner.winnerId) : null;

  return (
    <div className="space-y-8">
      {showConfetti && winner && <ConfettiEffect />}
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <PartyPopper className="h-8 w-8 text-accent" />
            Lucky Draw: {description || drawId}
          </CardTitle>
          <CardDescription>Manage participants and find out who the lucky winner is!</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode /> Share Draw</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            {qrCodeValue ? (
              <QRCode value={qrCodeValue} size={192} level="H" imageSettings={{src: "https://placehold.co/32x32.png", dataAiHint: "logo ticket", height: 32, width: 32, excavate: true}}/>
            ) : (
              <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground text-center">Scan this QR code to share this draw page with others.</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UsersRound /> Participants ({participants.length})</CardTitle>
            <CardDescription>Add participants to the draw. The more, the merrier!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!winner && (
              <div className="flex gap-2 items-end">
                <div className="flex-grow space-y-1">
                  <Label htmlFor="participant-name">Participant Name</Label>
                  <Input
                    id="participant-name"
                    placeholder="Enter name"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddParticipant()}
                    disabled={isLoading}
                  />
                </div>
                <Button onClick={handleAddParticipant} disabled={isLoading} className="h-10">
                  <UserPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            )}
            
            <ScrollArea className="h-48 border rounded-md p-2 bg-background">
              {participants.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No participants yet. Add some to get started!</p>
              ) : (
                <ul className="space-y-2">
                  {participants.map((p, index) => (
                    <li key={p.userId} className={`p-3 rounded-md flex justify-between items-center text-sm ${winnerParticipant && winnerParticipant.userId === p.userId ? 'bg-accent text-accent-foreground font-semibold ring-2 ring-accent' : 'bg-secondary'}`}>
                      <span>{index + 1}. {p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatDistanceToNow(p.joinTime, { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
          {!winner && (
            <CardFooter>
               <Button onClick={handleSelectWinner} disabled={isLoading || participants.length === 0} className="w-full text-lg py-6" size="lg">
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                {isLoading ? 'Selecting Winner...' : 'Pick the Lucky Winner!'}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">{error}</p>
          </CardContent>
        </Card>
      )}

      {winner && winnerParticipant && (
        <Card className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl transform scale-105 transition-transform duration-300">
          <CardHeader className="text-center">
            <Trophy className="h-20 w-20 mx-auto mb-4 text-yellow-300" />
            <CardTitle className="text-4xl font-bold">Congratulations!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-2xl">The lucky winner is...</p>
            <p className="text-5xl font-extrabold tracking-tight animate-pulse">{winnerParticipant.name}</p>
            <Separator className="my-4 bg-primary-foreground/50" />
            <p className="text-lg font-medium">AI's Reason for Selection:</p>
            <p className="text-md italic px-4">"{winner.reason}"</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => { setWinner(null); setShowConfetti(false); setParticipants([]) /* Optional: Clear participants for a new draw */}} variant="secondary" size="lg">
              Start a New Draw
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
