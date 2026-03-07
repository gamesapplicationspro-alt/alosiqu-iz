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
    <div className="w-full max-w-xl rounded-lg border border-gray-300 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
        {question.text}
      </h2>
      <div className="flex flex-col gap-4">
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
