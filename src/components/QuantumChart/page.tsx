"use client";
import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface QuantumChartProps {
  data: Record<string, number>;
}

export default function QuantumChart({ data }: QuantumChartProps) {
  const chartData = Object.entries(data).map(([key, value]) => ({
    result: key,
    count: value,
  }));

  return (
    <div className="w-full h-80 p-4 bg-white shadow-lg rounded-xl">
      <h2 className="text-xl font-bold mb-3 text-center">Quantum Measurement Results</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="result" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#4f46e5" barSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
