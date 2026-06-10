import React from 'react';
import { Play } from 'lucide-react';

export default function LearningCenter() {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-100">Learning Center</p>
          <p className="text-xs text-gray-400 mt-1">
            Learn how to use Willow effectively
          </p>
        </div>
        <button className="ml-4 p-2 hover:bg-gray-700 rounded-lg transition-colors">
          <Play className="text-gray-300" size={20} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
