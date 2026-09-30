import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  subject: { type: String, enum: ['math', 'bangla-1', 'bangla-2', 'english-1', 'english-2', 'global-studies', 'islam', 'ict'], required: true, default: 'math', index: true },
  grade: { type: Number, min: 5, max: 10, required: true, default: 7, index: true },
  type: { type: String, enum: ['mcq', 'short', 'cq', 'long'], required: true },
  chapter: { type: String, required: true, trim: true },
  prompt: { type: String, required: true, trim: true },
  equation: { type: String, default: '' },
  options: { type: [String], default: [] },
  optionEquations: { type: [String], default: [] },
  answer: { type: String, default: '' },
  answerEquation: { type: String, default: '' },
  marks: { type: Number, min: 1, required: true },
  figure: { type: String, enum: ['', 'triangle', 'circle', 'rectangle'], default: '' },
}, { timestamps: true })
questionSchema.index({ grade: 1, subject: 1, chapter: 1, type: 1 })

const paperSettingsSchema = new mongoose.Schema({
  subject: { type: String, enum: ['math', 'bangla-1', 'bangla-2', 'english-1', 'english-2', 'global-studies', 'islam', 'ict'], required: true },
  grade: { type: Number, min: 5, max: 10, required: true },
  schoolName: { type: String, default: 'বিদ্যালয়ের নাম' },
  schoolSubtitle: { type: String, default: '' },
  questionTextColor: { type: String, default: '#26352d', match: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i },
  paperTitle: { type: String, default: 'অর্ধবার্ষিক মূল্যায়ন' },
  paperDuration: { type: String, default: '২ ঘণ্টা' },
  paperClass: { type: String, default: 'সপ্তম' },
}, { timestamps: true })
paperSettingsSchema.index({ subject: 1, grade: 1 }, { unique: true })

export const Question = mongoose.models.Question ?? mongoose.model('Question', questionSchema)
export const PaperSettings = mongoose.models.PaperSettings ?? mongoose.model('PaperSettings', paperSettingsSchema)
