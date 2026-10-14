export interface AcademicPeriod {
  academicYear: string;
  term: string;
}

/**
 * Business rule (needs confirmation): the school year starts in August. Term 1 runs August to
 * December, Term 2 runs January to May, and June to July is the summer term.
 */
export function getAcademicPeriod(now: number): AcademicPeriod {
  const date = new Date(now);
  const month = date.getMonth(); // 0 = January
  const startYear = month >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    academicYear: `${startYear}\u2013${startYear + 1}`,
    term: month >= 7 ? 'Term 1' : month <= 4 ? 'Term 2' : 'Summer term',
  };
}