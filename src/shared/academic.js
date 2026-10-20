import { bengaliNumber } from './formatting.js'

export const grades = [5, 6, 7, 8, 9, 10]

export const subjects = [
  { id: 'math', label: 'গণিত' },
  { id: 'bangla-1', label: 'বাংলা ১ম পত্র' },
  { id: 'bangla-2', label: 'বাংলা ২য় পত্র' },
  { id: 'english-1', label: 'English 1st Paper' },
  { id: 'english-2', label: 'English 2nd Paper' },
  { id: 'global-studies', label: 'বাংলাদেশ ও বিশ্বপরিচয়' },
  { id: 'general-science', label: 'বিজ্ঞান' },
  { id: 'islam', label: 'ইসলাম ও নৈতিক শিক্ষা' },
  { id: 'hindu', label: 'হিন্দু ধর্ম' },
  { id: 'ict', label: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
  { id: 'Agriculture', label: 'কৃষিশিক্ষা' },
  { id: 'HigherMath', label: 'উচ্চতর গণিত' },
]

const gradeLabels = {
  5: 'পঞ্চম',
  6: 'ষষ্ঠ',
  7: 'সপ্তম',
  8: 'অষ্টম',
}

export const getSubjectLabel = (id) => subjects.find((subject) => subject.id === id)?.label ?? id

export function getGradeLabel(grade, {
  combinedLabel = 'নবম-দশম',
  includeClass = false,
  localizedFallback = true,
} = {}) {
  if (gradeLabels[grade]) return gradeLabels[grade]
  if (grade >= 9) return `${combinedLabel}${includeClass ? ' শ্রেণি' : ''}`
  return `শ্রেণি ${localizedFallback ? bengaliNumber(grade) : grade}`
}
