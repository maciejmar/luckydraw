
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createDrawInDb } from '@/lib/firebase'; // This now points to our in-memory store

export default function CreateDrawClient() {
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateDraw = async () => {
    if (description.trim() === '') {
      toast({
        title: 'Description Required',
        description: 'Please provide a description for the draw.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    const drawId = uuidv4();

    // Construct the URL for the specific draw page
    const drawUrl = `${window.location.origin}/draw/${drawId}`;
    
    try {
      // Using the in-memory store version
      await createDrawInDb(drawId, description.trim());
      toast({
        title: 'Draw Created (In-Memory)',
        description: `Your draw "${description.trim()}" is ready! Navigating...`,
      });

      // TODO: Use the drawUrl to generate a QR code here.
      // You will need to integrate your QR code generation library and display the QR code to the user.

      router.push(`/draw/${drawId}`); // Redirect to the new draw page
    } catch (error) {
      console.error("Failed to create draw or navigate:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: 'Error Creating Draw',
        description: `An error occurred: ${errorMessage}. Please try again.`, 
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false); 
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-3xl font-bold">
          <Sparkles className="h-8 w-8 text-accent" />
          Create a New Draw
        </CardTitle>
        <CardDescription>
          Enter a description for your draw. This will be visible to participants. (Data stored in memory, resets on server restart)
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
            disabled={isCreating}
          />
        </div>
        <Button onClick={handleCreateDraw} className="w-full text-lg py-6" size="lg" disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          {isCreating ? 'Creating Draw...' : 'Generate Your Lucky Draw'}
        </Button>
      </CardContent>
    </Card>
  );
}
