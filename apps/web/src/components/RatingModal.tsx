'use client';

import React, { useState } from 'react';

/**
 * RatingModal 评分弹窗
 * -------------------------------------------------------------
 * 实现原因：
 *  - 用户可在菜谱详情页对菜谱进行评分；
 *  - 组件独立，未来可接入后端评分 API。
 *
 * 具体实现方式：
 *  - 受控的 `open`、`onClose`、`onSubmit` 属性；
 *  - 简易星级选择（1-5 星），支持 hover 高亮；
 *  - 提交后调用 `onSubmit` 并关闭。
 */

export interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (stars: number, comment?: string) => Promise<void> | void;
}

export default function RatingModal({ open, onClose, onSubmit }: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (stars === 0) return; // 必须评分
    setLoading(true);
    try {
      await onSubmit(stars, comment.trim() || undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const starEls = Array.from({ length: 5 }, (_, i) => i + 1).map((i) => {
    const filled = i <= (hoverStar || stars);
    return (
      <button
        key={i}
        type="button"
        className="text-2xl"
        onClick={() => setStars(i)}
        onMouseEnter={() => setHoverStar(i)}
        onMouseLeave={() => setHoverStar(0)}
      >
        {filled ? '★' : '☆'}
      </button>
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-80 p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-center">评分</h3>
        <div className="flex items-center justify-center gap-1 mb-4">{starEls}</div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="可选：留下你的看法"
          className="w-full h-20 p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded border text-sm dark:border-gray-500"
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
            disabled={loading || stars === 0}
          >
            {loading ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>
  );
} 