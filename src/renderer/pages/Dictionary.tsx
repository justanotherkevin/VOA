import React from 'react';
import { Card, CardContent } from '@/renderer/components/card';
import { Button } from '@/renderer/components/button';
import { Plus } from 'lucide-react';

export default function Dictionary() {
  return (
    <div className="w-full h-full overflow-auto">
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dictionary</h1>
          <p className="text-gray-600 mt-2">Manage your custom words and phrases for better transcription accuracy</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Add New Word */}
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-8 flex flex-col items-center justify-center">
              <Button
                variant="outline"
                size="lg"
                className="flex items-center gap-2"
              >
                <Plus size={20} />
                Add New Word
              </Button>
              <p className="text-gray-600 text-sm mt-4">
                Add custom words, names, or technical terms to improve accuracy
              </p>
            </CardContent>
          </Card>

          {/* Dictionary Entries */}
          <Card className="border-0">
            <CardContent className="p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Dictionary Entries</h2>
              <p className="text-gray-600">No entries yet. Add your first custom word above!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
