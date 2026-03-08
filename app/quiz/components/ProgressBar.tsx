import React from "react";

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const percent = Math.round((current / total) * 100);
  return (
    <div className="w-full">
      <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded bg-blue-500 dark:bg-blue-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-gray-600 dark:text-gray-400">
        {current} / {total}
      </p>
    </div>
  );
}
