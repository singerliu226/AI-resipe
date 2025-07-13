'use client';

import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

/**
 * RecipeCard 组件
 * -------------------------------------------------------------
 * 实现原因：
 *  - 首页推荐及列表页需要复用一个统一的菜谱卡片；
 *  - 避免在各页面重复布局与交互逻辑；
 *  - 集中处理占位、错误图片、点击跳转等细节。
 *
 * 具体实现方式：
 *  - 接收 `recipe` 对象与可选 `href / onClick` 处理跳转；
 *  - 使用 next/image 优化图片加载，并提供模糊占位；
 *  - hover 时添加轻微缩放与阴影动画，提升可点击性；
 *  - 所有样式均使用 Tailwind CSS，保证暗黑模式可用。
 */

export interface RecipeSummary {
  /** 菜谱唯一标识 */
  id: number | string;
  /** 菜名 */
  name: string;
  /** 分类，例如 "Dessert" */
  category?: string | null;
  /** 主图片 URL，可为空 */
  thumbnail?: string | null;
  /** 卡路里，可选 */
  calories?: number | null;
}

export interface RecipeCardProps {
  recipe: RecipeSummary;
  /**
   * 跳转链接（优先级高于 onClick）。
   * 默认 `/recipes/[id]`。
   */
  href?: string;
  /** 点击回调，若同时存在 href，则包裹在 <Link> 内部触发。 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

function buildDefaultHref(id: string | number) {
  return `/recipes/${id}`;
}

const fallbackImg = '/window.svg'; // public 目录中已有占位图

export default function RecipeCard({ recipe, href, onClick, className = '' }: RecipeCardProps) {
  const Wrapper = href || onClick ? 'div' : React.Fragment; // 仅用于类型占位
  const content = (
    <article
      className={`bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden ${className}`}
      onClick={href ? undefined : onClick}
    >
      <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-700">
        <Image
          src={(recipe.thumbnail || fallbackImg) as string}
          alt={recipe.name}
          fill
          sizes="(min-width: 768px) 256px, 45vw"
          className="object-cover"
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjE5MiIgZmlsbD0iI2VjZWNlYyIgdmlld0JveD0iMCAwIDI1NiAxOTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PC9zdmc+"
        />
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-base font-semibold line-clamp-2 h-10">{recipe.name}</h3>
        {recipe.category && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{recipe.category}</p>
        )}
        {recipe.calories != null && (
          <p className="text-xs text-gray-600 dark:text-gray-300">≈ {Math.round(recipe.calories)} kcal</p>
        )}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="block">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left block w-full">
        {content}
      </button>
    );
  }

  return content;
} 