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
    "w-full rounded-md border-2 border-amber-600 p-3 text-left transition-all duration-300 transform hover:scale-102 shadow-md";

  if (isSelected) {
    baseClasses += " bg-amber-200 dark:bg-amber-800 border-amber-800";
  } else {
    baseClasses += " bg-yellow-50 dark:bg-yellow-900 hover:bg-amber-100 dark:hover:bg-amber-700 border-amber-400";
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
