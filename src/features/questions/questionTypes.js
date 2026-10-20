import { banglaSecondPaperSections } from '../../shared/banglaSecondPaper.js'

export const questionTypes = [
  { id: 'passage', label: 'Reading Text', labelBn: 'প্যাসেজ', labelEn: 'Reading Text', headingBn: 'প্যাসেজ', headingEn: 'Reading Text / Passage' },
  { id: 'mcq', label: 'MCQ', labelBn: 'বহুনির্বাচনি প্রশ্ন', labelEn: 'Multiple Choice Questions', headingBn: 'বহুনির্বাচনি প্রশ্ন', headingEn: 'Multiple Choice Questions' },
  { id: 'short', label: 'সংক্ষিপ্ত', labelBn: 'সংক্ষিপ্ত প্রশ্ন', labelEn: 'Short Answer Questions', headingBn: 'সংক্ষিপ্ত প্রশ্ন', headingEn: 'Short Answer Questions' },
  { id: 'true_false', label: 'True/False', labelBn: 'সত্য/মিথ্যা', labelEn: 'True/False', headingBn: 'সত্য/মিথ্যা', headingEn: 'True or False' },
  { id: 'fill_in_the_blanks', label: 'Fill in the blanks', labelBn: 'শূন্যস্থান পূরণ', labelEn: 'Fill in the blanks', headingBn: 'শূন্যস্থান পূরণ', headingEn: 'Complete the passage' },
  { id: 'matching', label: 'Matching', labelBn: 'মেলাও', labelEn: 'Matching', headingBn: 'মেলাও', headingEn: 'Matching (Column A & B)' },
  { id: 'rearrange', label: 'Rearrange', labelBn: 'পুনর্বিন্যাস', labelEn: 'Rearrange', headingBn: 'পুনর্বিন্যাস', headingEn: 'Rearrange Sentences' },
  { id: 'table_completion', label: 'Table Completion', labelBn: 'টেবিল পূরণ', labelEn: 'Table Completion', headingBn: 'টেবিল পূরণ', headingEn: 'Complete the table' },
  { id: 'synonym_antonym', label: 'Synonym/Antonym', labelBn: 'সমার্থক/বিপরীতার্থক', labelEn: 'Synonym/Antonym', headingBn: 'সমার্থক/বিপরীতার্থক', headingEn: 'Synonyms and Antonyms' },
  { id: 'cq', label: 'সৃজনশীল', labelBn: 'সৃজনশীল প্রশ্ন', labelEn: 'Creative Questions', headingBn: 'সৃজনশীল প্রশ্ন', headingEn: 'Creative Questions' },
  { id: 'long', label: 'বর্ণনামূলক', labelBn: 'বর্ণনামূলক প্রশ্ন', labelEn: 'Writing', headingBn: 'বর্ণনামূলক প্রশ্ন', headingEn: 'Writing' },
  ...banglaSecondPaperSections.map((section) => ({
    id: section.id,
    label: section.label,
    labelBn: section.label,
    labelEn: section.label,
    headingBn: section.label,
    headingEn: section.label,
  })),
]

export const chapterCountTypeLabels = { mcq: 'MCQ', cq: 'CQ', short: 'SQ', long: 'বর্ণনামূলক' }

export const typeLabel = (id, subject) => {
  const type = questionTypes.find((item) => item.id === id)
  return type ? (subject?.startsWith('english-') ? type.labelEn : type.labelBn) : id
}

export const typeHeading = (id, subject) => {
  const type = questionTypes.find((item) => item.id === id)
  return type ? (subject?.startsWith('english-') ? type.headingEn : type.headingBn) : id
}

export const optionLabelsFor = (subject) => subject.startsWith('english-')
  ? ['a', 'b', 'c', 'd']
  : ['ক', 'খ', 'গ', 'ঘ']

export const statementLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']
const statementOptionIndexes = [[0, 2], [0, 1], [1, 2], [0, 1, 2]]

export const statementOptionTexts = () => statementOptionIndexes.map((indexes) => {
  const labels = indexes.map((index) => statementLabels[index])
  return labels.length === 3 ? `${labels[0]}, ${labels[1]} ও ${labels[2]}` : `${labels[0]} ও ${labels[1]}`
})
