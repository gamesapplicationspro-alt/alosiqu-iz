import React from "react";
import { Answer } from "../../types";

interface AnswerButtonProps {
  answer: Answer;
  onClick: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

export default function AnswerButton({
  answer,
  onClick,
  disabled = false,
  isSelected = false,
}: AnswerButtonProps) {
  let baseClasses =
    "w-full rounded-md border p-3 text-left transition-colors";

  if (isSelected) {
    baseClasses += " bg-blue-100 dark:bg-blue-900";
  } else {
    baseClasses += " bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600";
  }

  return (
    <button
      className={baseClasses}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
    >
      {answer.text}
    </button>
  );
}
