import React from "react";

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const percent = Math.round((current / total) * 100);
  return (
    <div className="w-full mb-4 sm:mb-6">
      <div className="h-3 sm:h-4 w-full rounded bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded bg-blue-500 dark:bg-blue-400 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 sm:mt-2 text-right text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
        Ερώτηση {current} από {total}
      </p>
    </div>
  );
}
