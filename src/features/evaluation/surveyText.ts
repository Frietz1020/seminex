import type { Survey, SurveyQuestion } from '../../api/types';

/** Replaces {speaker} with the speaker's name. */
export function fillSpeaker(text: string, speaker: string): string {
  return text.split('{speaker}').join(speaker);
}

export interface NumberedQuestion {
  question: SurveyQuestion;
  number: number;
}

/** Questions in order, numbered across sections. */
export function numberQuestions(survey: Survey): NumberedQuestion[] {
  return survey.sections
    .flatMap((section) => section.questions)
    .map((question, index) => ({ question, number: index + 1 }));
}

export function questionCount(survey: Survey): number {
  return numberQuestions(survey).length;
}

export function formatQuestionCount(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/** Applies the speaker name to every piece of text the student reads. */
export function localizeQuestion(question: SurveyQuestion, speaker: string): SurveyQuestion {
  const prompt = fillSpeaker(question.prompt, speaker);
  const help = question.help ? fillSpeaker(question.help, speaker) : undefined;
  switch (question.type) {
    case 'rating':
      return { ...question, prompt, help, descriptors: question.descriptors.map((text) => fillSpeaker(text, speaker)) };
    case 'paragraph':
      return {
        ...question,
        prompt,
        help,
        placeholder: question.placeholder ? fillSpeaker(question.placeholder, speaker) : undefined,
      };
    default:
      return { ...question, prompt, help };
  }
}