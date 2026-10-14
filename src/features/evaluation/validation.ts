import type { EvaluationAnswers, Survey, SurveyQuestion } from '../../api/types';
import { numberQuestions } from './surveyText';

export function isAnswered(question: SurveyQuestion, answers: EvaluationAnswers): boolean {
  const value = answers[question.id];
  if (value === undefined || value === '') return false;
  return question.type === 'paragraph' ? value.trim().length > 0 : true;
}

/** Says what is missing and how to fix it, by question type. */
export function missingMessage(question: SurveyQuestion): string {
  switch (question.type) {
    case 'scale':
      return `Select a number from ${question.min} to ${question.max}.`;
    case 'rating':
      return `Select a rating from 1 to ${question.max} stars.`;
    case 'choice':
      return 'Choose one option.';
    case 'paragraph':
      return 'Write your answer.';
  }
}

/** Errors by question id, for required questions with no answer. */
export function validateSurvey(survey: Survey, answers: EvaluationAnswers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { question } of numberQuestions(survey)) {
    if (question.required && !isAnswered(question, answers)) errors[question.id] = missingMessage(question);
  }
  return errors;
}

function isValidValue(question: SurveyQuestion, value: string): boolean {
  switch (question.type) {
    case 'scale': {
      const number = Number(value);
      return Number.isInteger(number) && number >= question.min && number <= question.max;
    }
    case 'rating': {
      const number = Number(value);
      return Number.isInteger(number) && number >= 1 && number <= question.max;
    }
    case 'choice':
      return question.options.some((option) => option.value === value);
    case 'paragraph':
      return true;
  }
}

/** Keeps only answers that still fit the survey. Used when a saved draft is restored. */
export function sanitizeAnswers(survey: Survey, answers: EvaluationAnswers): EvaluationAnswers {
  const clean: EvaluationAnswers = {};
  for (const { question } of numberQuestions(survey)) {
    const value = answers[question.id];
    if (typeof value !== 'string' || !isValidValue(question, value)) continue;
    clean[question.id] = question.type === 'paragraph' ? value.slice(0, question.maxLength) : value;
  }
  return clean;
}