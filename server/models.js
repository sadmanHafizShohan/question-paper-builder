import mongoose from 'mongoose'

const isValidFigure = (value) => {
  if (['', 'triangle', 'circle', 'rectangle'].includes(value)) return true
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

const questionSchema = new mongoose.Schema({
  subject: { type: String, enum: ['math', 'bangla-1', 'bangla-2', 'english-1', 'english-2', 'global-studies','general-science', 'islam','hindu', 'ict' , 'Agriculture', 'HigherMath'], required: true, default: 'math', index: true },
  grade: { type: Number, min: 5, max: 10, required: true, default: 7, index: true },
  type: { type: String, enum: ['mcq', 'short', 'cq', 'long', 'passage', 'true_false', 'fill_in_the_blanks', 'matching', 'rearrange', 'table_completion', 'synonym_antonym'], required: true },
  chapter: { type: String, default: '', trim: true },
  prompt: { type: String, required: true, trim: true },
  equation: { type: String, default: '' },
  inlineEquations: { type: [String], default: [] },
  options: { type: [String], default: [] },
  statements: { type: [String], default: [] },
  statementQuestion: { type: String, default: '' },
  optionEquations: { type: [String], default: [] },
  optionInlineEquations: { type: [[String]], default: [] },
  answer: { type: String, default: '' },
  answerEquation: { type: String, default: '' },
  inlineAnswerEquations: { type: [String], default: [] },
  marks: { type: Number, min: 1, required: true },
  figure: {
    type: String,
    default: '',
    validate: {
      validator: isValidFigure,
      message: 'Figure must be a built-in shape or an HTTP(S) image URL',
    },
  },
}, { timestamps: true })
questionSchema.index({ grade: 1, subject: 1, chapter: 1, type: 1 })
questionSchema.index({ subject: 1, grade: 1, createdAt: -1, _id: -1 })

const paperSettingsSchema = new mongoose.Schema({
  subject: { type: String, enum: ['math', 'bangla-1', 'bangla-2', 'english-1', 'english-2', 'global-studies','general-science', 'islam','hindu', 'ict' , 'Agriculture', 'HigherMath'], required: true },
  grade: { type: Number, min: 5, max: 10, required: true },
  schoolName: { type: String, default: 'সৃজনশীল প্রাইভেট সেন্টার' },
  schoolSubtitle: { type: String, default: 'পুরাতন শহর, পুলিশ ফাঁড়ি মোড় সংলগ্ন,কুড়িগ্রাম\nমোবাইল ০১৭৭৩৪২৪০৫৭' },
  schoolLogo: { type: String, default: '' },
  paperSetCode: { type: String, default: 'SET-A', trim: true, maxlength: 32, match: /^[A-Za-z0-9_-]+$/ },
  questionTextColor: { type: String, default: '#26352d', match: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i },
  showChapters: { type: Boolean, default: true },
  watermark: { type: mongoose.Schema.Types.Mixed, default: () => ({ enabled: false, type: 'text', text: 'সৃজনশীল প্রাইভেট সেন্টার', image: '', color: '#76877d', size: 30, opacity: 0.14, position: 'center' }) },
  paperTitle: { type: String, default: 'সাপ্তাহিক পরিক্ষা' },
  paperDuration: { type: String, default: '২ ঘণ্টা' },
  paperClass: { type: String, default: 'সপ্তম' },
}, { timestamps: true })
paperSettingsSchema.index({ subject: 1, grade: 1 }, { unique: true })

const studentExamAttemptSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  displayName: { type: String, required: true },
  photoURL: { type: String, default: '' },
  grade: { type: Number, required: true, min: 5, max: 10, index: true },
  subject: { type: String, required: true, index: true },
  chapter: { type: String, default: '' },
  durationMinutes: { type: Number, required: true, min: 1, max: 20, default: 10 },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', index: true },
  items: [{
    prompt: { type: String, required: true },
    equation: { type: String, default: '' },
    inlineEquations: { type: [String], default: [] },
    statements: { type: [String], default: [] },
    statementQuestion: { type: String, default: '' },
    options: { type: [String], required: true },
    optionEquations: { type: [String], default: [] },
    optionInlineEquations: { type: [[String]], default: [] },
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
  }],
  score: { type: Number, min: 0 },
  totalQuestions: { type: Number, min: 1 },
  percentage: { type: Number, min: 0, max: 100 },
  submittedAnswers: { type: [Number], default: undefined },
  feedback: [{
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['admin', 'teacher'], required: true },
    message: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, required: true, default: Date.now },
  }],
  completedAt: { type: Date, index: true },
}, { timestamps: true })
studentExamAttemptSchema.index({ status: 1, completedAt: 1, grade: 1, subject: 1 })
studentExamAttemptSchema.index({ userId: 1, status: 1, completedAt: 1, grade: 1, subject: 1 })

const teacherRoleRequestSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  displayName: { type: String, default: '' },
  email: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending', index: true },
  approvedAt: { type: Date },
}, { timestamps: true })
teacherRoleRequestSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)

export const Question = mongoose.models.Question ?? mongoose.model('Question', questionSchema)
export const PaperSettings = mongoose.models.PaperSettings ?? mongoose.model('PaperSettings', paperSettingsSchema)
export const StudentExamAttempt = mongoose.models.StudentExamAttempt
  ?? mongoose.model('StudentExamAttempt', studentExamAttemptSchema)
export const TeacherRoleRequest = mongoose.models.TeacherRoleRequest
  ?? mongoose.model('TeacherRoleRequest', teacherRoleRequestSchema)
