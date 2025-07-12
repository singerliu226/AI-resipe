'use client';
import React, { useState } from 'react';

export default function ExplainTester() {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setExplanation(null);
    try {
      const resp = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_profile: { sex: 'male', age: 30, weight: 70, height: 175 },
          recipes: [
            {
              id: 1,
              name: '鸡胸肉三明治',
              calories: 350,
              macro: { pro: 30, fat: 8, carb: 35 },
            },
          ],
        }),
      });
      const data = await resp.json();
      setExplanation(data.explanation || JSON.stringify(data));
    } catch (err) {
      setExplanation('Error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 w-full max-w-xl flex flex-col gap-4">
      <button
        onClick={handleTest}
        className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? '生成中…' : '测试推荐解释'}
      </button>
      {explanation && (
        <div className="bg-white dark:bg-gray-900 p-6 rounded shadow-md border border-gray-200 dark:border-gray-700 space-y-2 text-sm leading-relaxed">
          {explanation.split(/\n+/).map((para, idx) => (
            <p key={idx}>• {para.trim()}</p>
          ))}
        </div>
      )}
    </div>
  );
} 