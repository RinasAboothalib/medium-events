import React from 'react';

export const StatStrip: React.FC<{ stats: { value: string; label: string }[] }> = ({ stats }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border-y border-line">
    {stats.map((stat) => (
      <div key={stat.label} className="bg-white py-6 px-4 sm:px-6">
        <p className="text-3xl sm:text-4xl font-bold text-ink tracking-tight">{stat.value}</p>
        <p className="mt-1 text-sm text-body">{stat.label}</p>
      </div>
    ))}
  </div>
);
