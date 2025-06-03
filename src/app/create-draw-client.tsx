
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CreateDrawClient() {
  const [description, setDescription] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateDraw = () => {
    if (description.trim() === '') {
      toast({
        title: 'Description Required',
        description: 'Please provide a description for the draw.',
        variant: 'destructive',
      });
      return;
    }
    const drawId = uuidv4();
    // Store description in localStorage to pass it to the draw page
    // Note: localStorage is only accessible on the client side.
    try {
      localStorage.setItem(`drawDescription-${drawId}`, description);
    } catch (error) {
      console.error("Failed to save to localStorage", error);
      toast({
        title: 'Storage Error',
        description: 'Could not save draw details. Please ensure cookies/localStorage are enabled.',
        variant: 'destructive',
      });
      return;
    }
    router.push(`/draw/${drawId}`);
  };

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="h-8 w-8 text-accent" />
          Create a New Draw
        </CardTitle>
        <CardDescription>
          Enter a description for your draw. This will be visible to participants.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="draw-description" className="text-lg">Draw Description</Label>
          <Textarea
            id="draw-description"
            placeholder="e.g., Weekly team lunch raffle, Holiday gift exchange winner..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="text-base"
          />
        </div>
        <Button onClick={handleCreateDraw} className="w-full text-lg py-6" size="lg">
          <Sparkles className="mr-2 h-5 w-5" />
          Generate Your Lucky Draw
        </Button>
      </CardContent>
    </Card>
  );
}
