import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import type { AuthoredQuestion, AuthoredSection, AuthoredSurvey } from '../../../api/orgTypes';
import type { SurveyOption } from '../../../api/types';
import { Icon } from '../../../components/ui/Icon';
import { sanitizeRichText } from '../../evaluation/richText';

type QuestionKind = AuthoredQuestion['type'];

function createQuestionType(question: AuthoredQuestion, type: QuestionKind): AuthoredQuestion {
  const base = { id: question.id, prompt: question.prompt, help: question.help, required: question.required };
  if (type === 'paragraph') return { ...base, type, maxLength: 600, placeholder: 'Your answer' };
  if (type === 'scale') return { ...base, type, min: 1, max: 5, startLabel: 'Not satisfied', endLabel: 'Very satisfied' };
  if (type === 'rating') return { ...base, type, max: 5, descriptors: ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'] };
  const options: SurveyOption[] =
    'options' in question
      ? question.options
      : [
          { value: 'option-1', label: 'Option 1' },
          { value: 'option-2', label: 'Option 2' },
        ];
  return { ...base, type, columns: 1, options };
}

function makeBlankQuestion(): AuthoredQuestion {
  return {
    id: `question-${crypto.randomUUID()}`,
    type: 'choice',
    prompt: '',
    required: false,
    columns: 1,
    options: [
      { value: `option-${crypto.randomUUID()}`, label: 'Option 1' },
      { value: `option-${crypto.randomUUID()}`, label: 'Option 2' },
    ],
  };
}

function makeBlankSection(index: number): AuthoredSection {
  return {
    id: `section-${crypto.randomUUID()}`,
    title: `Untitled section ${index + 1}`,
    description: '',
    questions: [],
  };
}

function applyPromptFormat(command: 'bold' | 'italic' | 'underline') {
  document.execCommand(command, false);
}

interface EvaluationBuilderProps {
  survey: AuthoredSurvey;
  onChange: (next: AuthoredSurvey) => void;
}

export function EvaluationBuilder({ survey, onChange }: EvaluationBuilderProps) {
  const sections: AuthoredSection[] =
    survey.sections.length > 0
      ? survey.sections
      : [{ id: 'section-1', title: 'General questions', questions: [] }];

  const [activeId, setActiveId] = useState<string>('form-header');
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);

  function commitSections(nextSections: AuthoredSection[], bumpVersion = true) {
    onChange({
      ...survey,
      version: bumpVersion ? survey.version + 1 : survey.version,
      sections: nextSections,
    });
  }

  function addQuestionToSection(sectionIndex: number, afterQuestionIndex?: number) {
    const fresh = makeBlankQuestion();
    const nextSections = sections.map((section, idx) => {
      if (idx !== sectionIndex) return section;
      const nextQuestions = [...section.questions];
      const insertAt = afterQuestionIndex !== undefined ? afterQuestionIndex + 1 : nextQuestions.length;
      nextQuestions.splice(insertAt, 0, fresh);
      return { ...section, questions: nextQuestions };
    });
    commitSections(nextSections);
    setActiveId(fresh.id);
  }

  function addSectionAfter(sectionIndex: number) {
    const fresh = makeBlankSection(sections.length);
    const nextSections = [...sections];
    nextSections.splice(sectionIndex + 1, 0, fresh);
    commitSections(nextSections);
    setActiveId(fresh.id);
  }

  function updateSection(sectionIndex: number, patch: Partial<AuthoredSection>) {
    const nextSections = sections.map((section, idx) => (idx === sectionIndex ? { ...section, ...patch } : section));
    commitSections(nextSections, false);
  }

  function moveSection(sectionIndex: number, delta: -1 | 1) {
    const target = sectionIndex + delta;
    if (target < 0 || target >= sections.length) return;
    const nextSections = [...sections];
    const [moved] = nextSections.splice(sectionIndex, 1);
    if (!moved) return;
    nextSections.splice(target, 0, moved);
    commitSections(nextSections);
  }

  function duplicateSection(sectionIndex: number) {
    const original = sections[sectionIndex];
    if (!original) return;
    const clone: AuthoredSection = {
      ...original,
      id: `section-${crypto.randomUUID()}`,
      title: original.title ? `${original.title} (copy)` : `Section ${sections.length + 1}`,
      questions: original.questions.map((q) => ({ ...q, id: `question-${crypto.randomUUID()}` })),
    };
    const nextSections = [...sections];
    nextSections.splice(sectionIndex + 1, 0, clone);
    commitSections(nextSections);
    setActiveId(clone.id);
  }

  function deleteSection(sectionIndex: number) {
    if (sections.length <= 1) return;
    const nextSections = sections.filter((_, idx) => idx !== sectionIndex);
    commitSections(nextSections);
    setActiveId(nextSections[Math.max(0, sectionIndex - 1)]?.id ?? 'form-header');
  }

  function updateQuestion(sectionIndex: number, questionIndex: number, nextQuestion: AuthoredQuestion) {
    const nextSections = sections.map((section, sIdx) =>
      sIdx !== sectionIndex
        ? section
        : {
            ...section,
            questions: section.questions.map((q, qIdx) => (qIdx === questionIndex ? nextQuestion : q)),
          },
    );
    commitSections(nextSections);
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    const nextSections = sections.map((section, sIdx) =>
      sIdx !== sectionIndex
        ? section
        : { ...section, questions: section.questions.filter((_, qIdx) => qIdx !== questionIndex) },
    );
    commitSections(nextSections);
  }

  function duplicateQuestion(sectionIndex: number, questionIndex: number) {
    const original = sections[sectionIndex]?.questions[questionIndex];
    if (!original) return;
    const clone: AuthoredQuestion = { ...original, id: `question-${crypto.randomUUID()}` };
    const nextSections = sections.map((section, sIdx) => {
      if (sIdx !== sectionIndex) return section;
      const nextQuestions = [...section.questions];
      nextQuestions.splice(questionIndex + 1, 0, clone);
      return { ...section, questions: nextQuestions };
    });
    commitSections(nextSections);
    setActiveId(clone.id);
  }

  function moveQuestion(sectionIndex: number, questionIndex: number, delta: -1 | 1) {
    const section = sections[sectionIndex];
    if (!section) return;
    const target = questionIndex + delta;
    if (target < 0 || target >= section.questions.length) return;
    const nextQuestions = [...section.questions];
    const [moved] = nextQuestions.splice(questionIndex, 1);
    if (!moved) return;
    nextQuestions.splice(target, 0, moved);
    const nextSections = sections.map((s, idx) => (idx === sectionIndex ? { ...s, questions: nextQuestions } : s));
    commitSections(nextSections);
  }

  function renderFloatingRail(sectionIndex: number, afterQuestionIndex?: number) {
    return (
      <div
        role="toolbar"
        aria-label="Form builder tools"
        className="flex h-fit items-center gap-1 rounded-xl border border-border-subtle bg-surface-card p-1.5 shadow-sm md:sticky md:top-24 md:flex-col"
      >
        <button
          type="button"
          onClick={() => addQuestionToSection(sectionIndex, afterQuestionIndex)}
          title="Add question"
          aria-label="Add question"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
        >
          <Icon name="add_circle" size={20} />
        </button>
        <button
          type="button"
          onClick={() => addSectionAfter(sectionIndex)}
          title="Add section (new page)"
          aria-label="Add section"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-container hover:text-primary"
        >
          <Icon name="view_agenda" size={20} />
        </button>
        <span className="h-5 w-px bg-border-subtle md:h-px md:w-6" />
        {(
          [
            ['bold', 'format_bold', 'Bold'],
            ['italic', 'format_italic', 'Italic'],
            ['underline', 'format_underlined', 'Underline'],
          ] as const
        ).map(([command, icon, label]) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyPromptFormat(command)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Icon name={icon} size={18} />
          </button>
        ))}
      </div>
    );
  }

  const hasMultipleSections = sections.length > 1;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* Form Title & Description Card — clean, no red top bar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem] md:items-start">
        <article
          onPointerDown={() => setActiveId('form-header')}
          onFocusCapture={() => setActiveId('form-header')}
          className={`rounded-2xl border bg-surface-card p-6 transition-all ${
            activeId === 'form-header'
              ? 'border-border-subtle border-l-[3px] border-l-primary shadow-card'
              : 'border-border-subtle shadow-sm'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 font-caption text-caption text-text-secondary">
              <Icon name="assignment_turned_in" size={16} className="text-primary" />
              Evaluation form
            </span>
            <span className="font-caption text-caption text-text-secondary tabular-nums">
              {hasMultipleSections ? `${sections.length} sections · ` : ''}
              {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
            </span>
          </div>

          <input
            aria-label="Form title"
            value={survey.title}
            onChange={(event) => onChange({ ...survey, title: event.target.value })}
            placeholder="Untitled form"
            className="mt-4 w-full border-b border-transparent bg-transparent pb-1.5 font-headline-sm text-headline-sm text-on-surface outline-none transition-colors placeholder:text-text-subtle hover:border-border-subtle focus:border-primary"
          />
          <textarea
            aria-label="Form description"
            rows={2}
            value={survey.instructions}
            onChange={(event) => onChange({ ...survey, instructions: event.target.value })}
            placeholder="Form description"
            className="mt-2 w-full resize-none border-b border-transparent bg-transparent py-1 font-body-sm text-body-sm text-text-secondary outline-none transition-colors placeholder:text-text-subtle hover:border-border-subtle focus:border-primary"
          />
        </article>
        {activeId === 'form-header' ? renderFloatingRail(0) : <div aria-hidden="true" className="hidden md:block" />}
      </div>

      {/* Sections & Questions */}
      {sections.map((section, sectionIndex) => (
        <div key={section.id} className="flex flex-col gap-3.5">
          {/* Section Header Card (shown whenever there are 2+ sections, GForms page-break style) */}
          {hasMultipleSections && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem] md:items-start">
              <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 border-border-subtle bg-surface-container px-3.5 py-1.5 font-label-sm text-label-sm text-on-surface tabular-nums">
                    Section {sectionIndex + 1} of {sections.length}
                  </span>
                </div>
                <article
                  onPointerDown={() => setActiveId(section.id)}
                  onFocusCapture={() => setActiveId(section.id)}
                  className={`rounded-2xl rounded-tl-none border bg-surface-card p-5 transition-all ${
                    activeId === section.id
                      ? 'border-border-subtle border-l-[3px] border-l-primary shadow-card'
                      : 'border-border-subtle shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Section ${sectionIndex + 1} title`}
                        value={section.title}
                        onChange={(event) => updateSection(sectionIndex, { title: event.target.value })}
                        placeholder="Untitled section"
                        className="w-full border-b border-transparent bg-transparent pb-1 font-title-md text-title-md text-on-surface outline-none transition-colors placeholder:text-text-subtle hover:border-border-subtle focus:border-primary"
                      />
                      <input
                        aria-label={`Section ${sectionIndex + 1} description`}
                        value={section.description ?? ''}
                        onChange={(event) => updateSection(sectionIndex, { description: event.target.value })}
                        placeholder="Description (optional)"
                        className="mt-1.5 w-full border-b border-transparent bg-transparent py-1 font-body-sm text-body-sm text-text-secondary outline-none transition-colors placeholder:text-text-subtle hover:border-border-subtle focus:border-primary"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={sectionIndex === 0}
                        onClick={() => moveSection(sectionIndex, -1)}
                        title="Move section up"
                        aria-label={`Move section ${sectionIndex + 1} up`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-container disabled:opacity-30"
                      >
                        <Icon name="arrow_upward" size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={sectionIndex === sections.length - 1}
                        onClick={() => moveSection(sectionIndex, 1)}
                        title="Move section down"
                        aria-label={`Move section ${sectionIndex + 1} down`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-container disabled:opacity-30"
                      >
                        <Icon name="arrow_downward" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateSection(sectionIndex)}
                        title="Duplicate section"
                        aria-label={`Duplicate section ${sectionIndex + 1}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-container"
                      >
                        <Icon name="content_copy" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSection(sectionIndex)}
                        title="Delete section"
                        aria-label={`Delete section ${sectionIndex + 1}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-error-container hover:text-error"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              </div>
              {activeId === section.id ? renderFloatingRail(sectionIndex) : <div aria-hidden="true" className="hidden md:block" />}
            </div>
          )}

          {/* Questions inside this section */}
          {section.questions.length === 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem] md:items-start">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-surface-card/70 px-6 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container text-primary">
                  <Icon name="rate_review" size={22} />
                </div>
                <h3 className="mt-3 font-title-sm text-title-sm text-on-surface">
                  {hasMultipleSections ? `No questions in section ${sectionIndex + 1} yet` : 'Add your first question'}
                </h3>
                <p className="mt-1 max-w-sm font-body-sm text-body-sm text-text-secondary">
                  Choose a response type and write a clear prompt for participants.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => addQuestionToSection(sectionIndex)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                  >
                    <Icon name="add" size={18} />
                    <span>Add question</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addSectionAfter(sectionIndex)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-4 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
                  >
                    <Icon name="view_agenda" size={18} />
                    <span>Add section</span>
                  </button>
                </div>
              </div>
              <div aria-hidden="true" className="hidden md:block" />
            </div>
          ) : (
            section.questions.map((question, questionIndex) => {
              const isActive = activeId === question.id;
              return (
                <div
                  key={question.id}
                  className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem] md:items-start"
                >
                  <QuestionCard
                    question={question}
                    active={isActive}
                    canMoveUp={questionIndex > 0}
                    canMoveDown={questionIndex < section.questions.length - 1}
                    onActivate={() => setActiveId(question.id)}
                    onChange={(next) => updateQuestion(sectionIndex, questionIndex, next)}
                    onRemove={() => removeQuestion(sectionIndex, questionIndex)}
                    onDuplicate={() => duplicateQuestion(sectionIndex, questionIndex)}
                    onMoveUp={() => moveQuestion(sectionIndex, questionIndex, -1)}
                    onMoveDown={() => moveQuestion(sectionIndex, questionIndex, 1)}
                  />
                  {isActive ? (
                    renderFloatingRail(sectionIndex, questionIndex)
                  ) : (
                    <div aria-hidden="true" className="hidden md:block" />
                  )}
                </div>
              );
            })
          )}

          {/* Page-break cue between sections */}
          {hasMultipleSections && sectionIndex < sections.length - 1 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem]">
              <div className="flex items-center gap-3 py-1 text-text-subtle">
                <span className="h-px flex-1 bg-border-subtle" />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1 font-caption text-caption text-text-secondary">
                  After section {sectionIndex + 1}
                  <Icon name="arrow_forward" size={14} />
                  Next page (Section {sectionIndex + 2})
                </span>
                <span className="h-px flex-1 bg-border-subtle" />
              </div>
              <div aria-hidden="true" className="hidden md:block" />
            </div>
          )}
        </div>
      ))}

      {/* Quick bottom bar — hidden when the last section is empty (its empty state already has these actions) */}
      {(sections[sections.length - 1]?.questions.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_3.25rem]">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-card/80 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => addQuestionToSection(sections.length - 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container px-3.5 font-body-sm-medium text-body-sm-medium text-on-surface transition-colors hover:bg-primary hover:text-on-primary"
              >
                <Icon name="add_circle" size={18} />
                <span>Add question</span>
              </button>
              <button
                type="button"
                onClick={() => addSectionAfter(sections.length - 1)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3.5 font-body-sm-medium text-body-sm-medium text-text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <Icon name="view_agenda" size={18} />
                <span>Add section (next page)</span>
              </button>
            </div>
            <p className="font-caption text-caption text-text-subtle">
              Responses follow your organization’s evaluation privacy rules.
            </p>
          </div>
          <div aria-hidden="true" className="hidden md:block" />
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  active,
  canMoveUp,
  canMoveDown,
  onActivate,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  question: AuthoredQuestion;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onActivate: () => void;
  onChange: (question: AuthoredQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const options = 'options' in question ? question.options : null;
  const promptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (promptRef.current) promptRef.current.innerHTML = sanitizeRichText(question.prompt);
    // Sync only when switching to a different question id to preserve caret position while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  function onPromptInput() {
    if (promptRef.current) onChange({ ...question, prompt: sanitizeRichText(promptRef.current.innerHTML) });
  }

  function onPromptPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  }

  function addOption() {
    if (!options || (question.type !== 'choice' && question.type !== 'checkbox')) return;
    onChange({
      ...question,
      options: [...question.options, { value: `option-${crypto.randomUUID()}`, label: `Option ${question.options.length + 1}` }],
    });
  }

  return (
    <article
      onPointerDown={onActivate}
      onFocusCapture={onActivate}
      className={`rounded-2xl border bg-surface-card p-5 transition-all ${
        active
          ? 'border-border-subtle border-l-[3px] border-l-primary shadow-card'
          : 'border-border-subtle shadow-sm hover:border-outline-variant'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Prompt + Type Selector */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div
            ref={promptRef}
            data-prompt-editor={question.id}
            role="textbox"
            aria-label="Question prompt"
            aria-multiline="true"
            contentEditable
            suppressContentEditableWarning
            onInput={onPromptInput}
            onPaste={onPromptPaste}
            data-placeholder="Question"
            className="min-h-11 min-w-0 flex-1 rounded-t-lg border-b-2 border-border-subtle bg-surface-container-low/80 px-3.5 py-2.5 font-body-base text-body-base text-on-surface outline-none transition-colors focus:border-primary focus:bg-surface-container-low empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-text-subtle"
          />
          <select
            aria-label="Question type"
            value={question.type}
            onChange={(event) => onChange(createQuestionType(question, event.target.value as QuestionKind))}
            className="h-11 w-full shrink-0 rounded-lg border border-border-subtle bg-surface-light px-3 font-body-sm text-body-sm text-on-surface outline-none transition-colors focus:border-primary sm:w-44"
          >
            <option value="choice">Multiple choice</option>
            <option value="checkbox">Checkboxes</option>
            <option value="paragraph">Paragraph</option>
            <option value="scale">Linear scale</option>
            <option value="rating">Rating</option>
          </select>
        </div>

        {/* Paragraph preview */}
        {question.type === 'paragraph' && (
          <div className="max-w-md border-b border-dashed border-border-subtle pb-2 font-body-sm text-body-sm text-text-subtle">
            Long answer text
          </div>
        )}

        {/* Multiple Choice / Checkboxes options */}
        {(question.type === 'choice' || question.type === 'checkbox') && options && (
          <div className="flex flex-col gap-1.5">
            {options.map((option, optionIndex) => (
              <div key={option.value} className="group flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 border-2 border-outline-variant ${
                    question.type === 'choice' ? 'rounded-full' : 'rounded-sm'
                  }`}
                />
                <input
                  aria-label={`Option ${optionIndex + 1}`}
                  value={option.label}
                  onChange={(event) =>
                    onChange({
                      ...question,
                      options: question.options.map((item, index) =>
                        index === optionIndex ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder={`Option ${optionIndex + 1}`}
                  className="h-9 min-w-0 flex-1 border-b border-transparent bg-transparent font-body-sm text-body-sm text-on-surface outline-none transition-colors hover:border-border-subtle focus:border-primary"
                />
                <button
                  type="button"
                  aria-label={`Remove option ${optionIndex + 1}`}
                  disabled={options.length <= 1}
                  onClick={() =>
                    onChange({
                      ...question,
                      options: question.options.filter((_, index) => index !== optionIndex),
                    })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-subtle opacity-70 transition-colors hover:bg-surface-container hover:text-on-surface hover:opacity-100 disabled:opacity-20"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 border-2 border-dashed border-outline-variant/60 ${
                  question.type === 'choice' ? 'rounded-full' : 'rounded-sm'
                }`}
              />
              <button
                type="button"
                onClick={addOption}
                className="font-body-sm text-body-sm text-primary hover:underline"
              >
                Add option
              </button>
            </div>
          </div>
        )}

        {/* Linear scale */}
        {question.type === 'scale' && (
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low/70 p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Scale minimum"
                value={question.min}
                onChange={(event) => {
                  const min = Number(event.target.value);
                  if (min < question.max) onChange({ ...question, min });
                }}
                className="h-9 rounded-lg border border-border-subtle bg-surface-card px-2.5 font-body-sm text-body-sm text-on-surface tabular-nums"
              >
                <option value={0}>0</option>
                <option value={1}>1</option>
              </select>
              <span className="font-body-sm text-body-sm text-text-secondary">to</span>
              <select
                aria-label="Scale maximum"
                value={question.max}
                onChange={(event) => {
                  const max = Number(event.target.value);
                  if (max > question.min) onChange({ ...question, max });
                }}
                className="h-9 rounded-lg border border-border-subtle bg-surface-card px-2.5 font-body-sm text-body-sm text-on-surface tabular-nums"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex items-center gap-2 font-caption text-caption text-text-secondary">
                <span className="w-5 text-center font-body-sm-medium text-on-surface tabular-nums">{question.min}</span>
                <input
                  aria-label="First value label"
                  type="text"
                  value={question.startLabel}
                  onChange={(event) => onChange({ ...question, startLabel: event.target.value })}
                  placeholder="Label (optional)"
                  className="h-9 min-w-0 flex-1 border-b border-border-subtle bg-transparent px-1 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-2 font-caption text-caption text-text-secondary">
                <span className="w-5 text-center font-body-sm-medium text-on-surface tabular-nums">{question.max}</span>
                <input
                  aria-label="Last value label"
                  type="text"
                  value={question.endLabel}
                  onChange={(event) => onChange({ ...question, endLabel: event.target.value })}
                  placeholder="Label (optional)"
                  className="h-9 min-w-0 flex-1 border-b border-border-subtle bg-transparent px-1 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                />
              </label>
            </div>

            <input
              aria-label="Question description"
              type="text"
              value={question.description ?? ''}
              onChange={(event) => onChange({ ...question, description: event.target.value })}
              placeholder="Helper description (optional)"
              className="h-8 border-b border-transparent bg-transparent px-1 font-caption text-caption text-text-secondary outline-none hover:border-border-subtle focus:border-primary"
            />
          </div>
        )}

        {/* Rating */}
        {question.type === 'rating' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low/70 px-4 py-3">
            <div className="flex items-center gap-1.5 text-secondary">
              {Array.from({ length: Math.min(10, Math.max(2, question.max)) }, (_, idx) => (
                <Icon key={idx} name="star" size={22} />
              ))}
            </div>
            <label className="flex items-center gap-2 font-caption text-caption text-text-secondary">
              Levels
              <select
                aria-label="Max rating"
                value={question.max}
                onChange={(event) => {
                  const max = Number(event.target.value);
                  onChange({ ...question, max, descriptors: question.descriptors.slice(0, max) });
                }}
                className="h-8 rounded-lg border border-border-subtle bg-surface-card px-2 font-body-sm text-body-sm text-on-surface tabular-nums"
              >
                {[3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* GForms Footer Bar */}
        <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border-subtle pt-3">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            title="Move question up"
            aria-label="Move question up"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-container disabled:opacity-30"
          >
            <Icon name="arrow_upward" size={18} />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            title="Move question down"
            aria-label="Move question down"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-container disabled:opacity-30"
          >
            <Icon name="arrow_downward" size={18} />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            title="Duplicate question"
            aria-label="Duplicate question"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-container"
          >
            <Icon name="content_copy" size={18} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Delete question"
            aria-label="Delete question"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-error-container hover:text-error"
          >
            <Icon name="delete" size={18} />
          </button>
          <span className="mx-2 h-6 w-px bg-border-subtle" />
          <label className="inline-flex cursor-pointer select-none items-center gap-2.5 font-body-sm text-body-sm text-text-secondary">
            <span>Required</span>
            <button
              type="button"
              role="switch"
              aria-checked={question.required}
              aria-label="Required"
              onClick={() => onChange({ ...question, required: !question.required })}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                question.required ? 'bg-primary' : 'bg-outline-variant/70'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  question.required ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    </article>
  );
}
