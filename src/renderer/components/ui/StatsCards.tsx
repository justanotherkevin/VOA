import React from 'react';
import { BookOpen, Clock, Zap } from 'lucide-react';
import { Card, CardContent } from '@/renderer/components/card';

interface StatsCardsProps {
  dictatedWords?: number;
  savedMinutes?: number;
  dictatedWPM?: number;
}

export default function StatsCards({
  dictatedWords = 44,
  savedMinutes = 1,
  dictatedWPM = 133
}: StatsCardsProps) {
  const stats = [
    {
      label: 'Dictated Words',
      value: dictatedWords.toString(),
      icon: <BookOpen size={24} className="text-blue-600" />,
      color: 'bg-blue-50',
    },
    {
      label: 'Saved Minutes',
      value: savedMinutes.toString(),
      icon: <Clock size={24} className="text-blue-600" />,
      color: 'bg-blue-50',
    },
    {
      label: 'Dictated WPM',
      value: dictatedWPM.toString(),
      icon: <Zap size={24} className="text-blue-600" />,
      color: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className={`${stat.color} border-none`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">{stat.label}</p>
              {stat.icon}
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
