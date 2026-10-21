import mongoose from 'mongoose'

const coachingCenterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, default: '', trim: true, maxlength: 300 },
  contactPhone: { type: String, default: '', trim: true, maxlength: 30 },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true })

const coachingCenterRequestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, default: '', trim: true, maxlength: 300 },
  contactPhone: { type: String, default: '', trim: true, maxlength: 30 },
  requesterId: { type: String, required: true, index: true },
  requesterName: { type: String, default: '' },
  requesterEmail: { type: String, default: '' },
  requesterPhotoURL: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'processing', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date },
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter' },
}, { timestamps: true })
coachingCenterRequestSchema.index(
  { requesterId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)

const coachingMembershipSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  userId: { type: String, required: true, index: true },
  displayName: { type: String, default: '' },
  email: { type: String, default: '' },
  photoURL: { type: String, default: '' },
  role: { type: String, enum: ['owner', 'manager', 'teacher', 'student', 'accountant'], required: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
}, { timestamps: true })
coachingMembershipSchema.index({ centerId: 1, userId: 1 }, { unique: true })

const coachingStudentSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  studentCode: { type: String, required: true, trim: true, maxlength: 40 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  guardianName: { type: String, default: '', trim: true, maxlength: 120 },
  guardianPhone: { type: String, default: '', trim: true, maxlength: 30 },
  photoURL: { type: String, default: '', trim: true, maxlength: 500 },
  grade: { type: Number, min: 1, max: 12, required: true },
  linkedUserId: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true })
coachingStudentSchema.index({ centerId: 1, studentCode: 1 }, { unique: true })
coachingStudentSchema.index({ centerId: 1, linkedUserId: 1 })

const coachingTeacherSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  subjects: { type: [String], default: [] },
  linkedUserId: { type: String, default: '' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true })
coachingTeacherSchema.index({ centerId: 1, linkedUserId: 1 })
coachingTeacherSchema.index({ centerId: 1, email: 1 })

const coachingBatchSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  grade: { type: Number, min: 1, max: 12, required: true },
  subject: { type: String, required: true, trim: true, maxlength: 80 },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingTeacher', default: null },
  schedule: { type: String, default: '', trim: true, maxlength: 300 },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true })
coachingBatchSchema.index({ centerId: 1, status: 1, name: 1 })

const coachingEnrollmentSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  status: { type: String, enum: ['active', 'withdrawn'], default: 'active', index: true },
  enrolledAt: { type: Date, default: Date.now },
}, { timestamps: true })
coachingEnrollmentSchema.index({ centerId: 1, batchId: 1, studentId: 1 }, { unique: true })

const coachingAttendanceSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
  markedBy: { type: String, required: true },
}, { timestamps: true })
coachingAttendanceSchema.index({ centerId: 1, batchId: 1, date: 1, studentId: 1 }, { unique: true })
coachingAttendanceSchema.index({ centerId: 1, date: 1 })

const coachingFeeRecordSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  feeMonth: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  amount: { type: Number, required: true, min: 1, max: 100_000_000 },
  paymentDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  category: { type: String, enum: ['tuition', 'admission', 'exam', 'other'], required: true },
  method: { type: String, enum: ['cash', 'bank', 'mobile_banking', 'other'], required: true },
  reference: { type: String, default: '', trim: true, maxlength: 80 },
  note: { type: String, default: '', trim: true, maxlength: 300 },
  recordedBy: { type: String, required: true },
}, { timestamps: true })
coachingFeeRecordSchema.index({ centerId: 1, feeMonth: 1, paymentDate: -1 })
coachingFeeRecordSchema.index({ centerId: 1, studentId: 1, feeMonth: 1 })

const coachingExamSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  examDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  totalMarks: { type: Number, required: true, min: 1, max: 100_000 },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  createdBy: { type: String, required: true },
}, { timestamps: true })
coachingExamSchema.index({ centerId: 1, batchId: 1, examDate: -1 })

const coachingExamResultSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingExam', required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  marks: { type: Number, required: true, min: 0, max: 100_000 },
  remarks: { type: String, default: '', trim: true, maxlength: 300 },
  recordedBy: { type: String, required: true },
}, { timestamps: true })
coachingExamResultSchema.index({ centerId: 1, examId: 1, studentId: 1 }, { unique: true })
coachingExamResultSchema.index({ centerId: 1, studentId: 1, examId: 1 })

const coachingNoticeSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  audience: { type: String, enum: ['all', 'batch'], required: true, default: 'all' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', default: null },
  expiresAt: { type: String, default: '', match: /^$|^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  createdBy: { type: String, required: true },
  creatorName: { type: String, default: '' },
}, { timestamps: true })
coachingNoticeSchema.index({ centerId: 1, status: 1, createdAt: -1 })
coachingNoticeSchema.index({ centerId: 1, batchId: 1, status: 1 })

const coachingNoticeReadSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  noticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingNotice', required: true },
  userId: { type: String, required: true },
  readAt: { type: Date, default: Date.now },
}, { timestamps: true })
coachingNoticeReadSchema.index({ centerId: 1, noticeId: 1, userId: 1 }, { unique: true })
coachingNoticeReadSchema.index({ centerId: 1, userId: 1, readAt: -1 })

export const CoachingCenter = mongoose.models.CoachingCenter ?? mongoose.model('CoachingCenter', coachingCenterSchema)
export const CoachingCenterRequest = mongoose.models.CoachingCenterRequest
  ?? mongoose.model('CoachingCenterRequest', coachingCenterRequestSchema)
export const CoachingMembership = mongoose.models.CoachingMembership
  ?? mongoose.model('CoachingMembership', coachingMembershipSchema)
export const CoachingStudent = mongoose.models.CoachingStudent ?? mongoose.model('CoachingStudent', coachingStudentSchema)
export const CoachingTeacher = mongoose.models.CoachingTeacher ?? mongoose.model('CoachingTeacher', coachingTeacherSchema)
export const CoachingBatch = mongoose.models.CoachingBatch ?? mongoose.model('CoachingBatch', coachingBatchSchema)
export const CoachingEnrollment = mongoose.models.CoachingEnrollment
  ?? mongoose.model('CoachingEnrollment', coachingEnrollmentSchema)
export const CoachingAttendance = mongoose.models.CoachingAttendance
  ?? mongoose.model('CoachingAttendance', coachingAttendanceSchema)
export const CoachingFeeRecord = mongoose.models.CoachingFeeRecord
  ?? mongoose.model('CoachingFeeRecord', coachingFeeRecordSchema)
export const CoachingExam = mongoose.models.CoachingExam ?? mongoose.model('CoachingExam', coachingExamSchema)
export const CoachingExamResult = mongoose.models.CoachingExamResult
  ?? mongoose.model('CoachingExamResult', coachingExamResultSchema)
export const CoachingNotice = mongoose.models.CoachingNotice ?? mongoose.model('CoachingNotice', coachingNoticeSchema)
export const CoachingNoticeRead = mongoose.models.CoachingNoticeRead
  ?? mongoose.model('CoachingNoticeRead', coachingNoticeReadSchema)
