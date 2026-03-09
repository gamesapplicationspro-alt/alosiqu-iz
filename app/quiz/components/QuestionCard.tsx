import React from "react";
import { Question } from "../../types";
import AnswerButton from "./AnswerButton";

interface QuestionCardProps {
  question: Question;
  onSelect: (answerId: string) => void;
  selectedAnswerId: string | null;
}

export default function QuestionCard({
  question,
  onSelect,
  selectedAnswerId,
}: QuestionCardProps) {
  return (
    <div className="w-full max-w-2xl sm:max-w-xl rounded-lg border-2 border-amber-800 bg-gradient-to-br from-yellow-50 to-amber-100 p-4 sm:p-6 shadow-2xl dark:border-amber-600 dark:from-yellow-900 dark:to-amber-900 parchment-bg animate-slide-up">
      <h2 className="mb-3 sm:mb-4 text-lg sm:text-xl font-bold text-amber-900 dark:text-amber-100 drop-shadow-md">
        {question.text}
      </h2>
      <div className="flex flex-col gap-3 sm:gap-4">
        {question.answers.map((ans) => (
          <AnswerButton
            key={ans.id}
            answer={ans}
            onClick={() => onSelect(ans.id)}
            disabled={selectedAnswerId !== null}
            isSelected={selectedAnswerId === ans.id}
          />
        ))}
      </div>
    </div>
  );
}
