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
  englishName: { type: String, default: '', trim: true, maxlength: 120 },
  studentCode: { type: String, required: true, trim: true, maxlength: 40 },
  fatherName: { type: String, default: '', trim: true, maxlength: 120 },
  motherName: { type: String, default: '', trim: true, maxlength: 120 },
  permanentDistrict: { type: String, default: '', trim: true, maxlength: 100 },
  permanentPostOffice: { type: String, default: '', trim: true, maxlength: 100 },
  permanentVillage: { type: String, default: '', trim: true, maxlength: 100 },
  permanentArea: { type: String, default: '', trim: true, maxlength: 100 },
  presentDistrict: { type: String, default: '', trim: true, maxlength: 100 },
  presentPostOffice: { type: String, default: '', trim: true, maxlength: 100 },
  presentVillage: { type: String, default: '', trim: true, maxlength: 100 },
  presentArea: { type: String, default: '', trim: true, maxlength: 100 },
  phone: { type: String, default: '', trim: true, maxlength: 30 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 254 },
  guardianName: { type: String, default: '', trim: true, maxlength: 120 },
  guardianPhone: { type: String, default: '', trim: true, maxlength: 30 },
  guardianWhatsAppOptIn: { type: Boolean, default: false },
  guardianWhatsAppOptInAt: { type: Date },
  guardianWhatsAppOptInBy: { type: String, default: '' },
  guardianWhatsAppOptOutAt: { type: Date },
  guardianDistrict: { type: String, default: '', trim: true, maxlength: 100 },
  guardianPostOffice: { type: String, default: '', trim: true, maxlength: 100 },
  guardianVillage: { type: String, default: '', trim: true, maxlength: 100 },
  guardianArea: { type: String, default: '', trim: true, maxlength: 100 },
  nationality: { type: String, default: '', trim: true, maxlength: 80 },
  religion: { type: String, default: '', trim: true, maxlength: 80 },
  dateOfBirth: { type: String, default: '', match: /^$|^\d{4}-\d{2}-\d{2}$/ },
  previousGrade: { type: String, default: '', trim: true, maxlength: 40 },
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
  history: {
    type: [{
      action: { type: String, enum: ['enrolled', 'withdrawn', 'reactivated'], required: true },
      date: { type: Date, default: Date.now },
      note: { type: String, default: '', trim: true, maxlength: 300 },
      changedBy: { type: String, required: true },
    }],
    default: [],
  },
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

const coachingClassSessionSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingBatch', required: true },
  title: { type: String, default: '', trim: true, maxlength: 120 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled', index: true },
  createdBy: { type: String, required: true },
  history: {
    type: [{
      action: { type: String, enum: ['scheduled', 'rescheduled', 'cancelled'], required: true },
      fromDate: { type: String, default: '' },
      fromStartTime: { type: String, default: '' },
      fromEndTime: { type: String, default: '' },
      note: { type: String, default: '', trim: true, maxlength: 300 },
      changedBy: { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
}, { timestamps: true })
coachingClassSessionSchema.index({ centerId: 1, date: 1, status: 1 })
coachingClassSessionSchema.index({ centerId: 1, batchId: 1, date: 1 })

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
  status: { type: String, enum: ['active', 'voided'], default: 'active', index: true },
  voidedAt: { type: Date },
  voidedBy: { type: String, default: '' },
  voidReason: { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true })
coachingFeeRecordSchema.index({ centerId: 1, feeMonth: 1, paymentDate: -1 })
coachingFeeRecordSchema.index({ centerId: 1, studentId: 1, feeMonth: 1 })

const coachingFeePlanSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  monthlyAmount: { type: Number, required: true, min: 1, max: 100_000_000 },
  startsMonth: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  dueDay: { type: Number, default: 10, min: 1, max: 28 },
  updatedBy: { type: String, required: true },
}, { timestamps: true })
coachingFeePlanSchema.index({ centerId: 1, studentId: 1, startsMonth: 1 }, { unique: true })

const coachingGuardianContactSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  method: { type: String, enum: ['phone', 'in_person', 'other'], required: true },
  reason: { type: String, enum: ['fee_due', 'absence', 'academic', 'general'], required: true },
  note: { type: String, required: true, trim: true, maxlength: 1000 },
  contactedAt: { type: Date, default: Date.now },
  contactedBy: { type: String, required: true },
}, { timestamps: true })
coachingGuardianContactSchema.index({ centerId: 1, studentId: 1, contactedAt: -1 })

const coachingWhatsAppMessageSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingStudent', required: true },
  recipientPhone: { type: String, required: true, maxlength: 30 },
  templateName: { type: String, required: true, maxlength: 120 },
  purpose: { type: String, enum: ['fee_due', 'absence', 'schedule'], required: true },
  status: { type: String, enum: ['queued', 'sent', 'failed'], required: true, index: true },
  providerMessageId: { type: String, default: '', maxlength: 120 },
  error: { type: String, default: '', maxlength: 500 },
  sentBy: { type: String, required: true },
}, { timestamps: true })
coachingWhatsAppMessageSchema.index({ centerId: 1, createdAt: -1 })

const coachingAuditEventSchema = new mongoose.Schema({
  centerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CoachingCenter', required: true, index: true },
  actorId: { type: String, required: true },
  action: { type: String, required: true, maxlength: 80 },
  entityType: { type: String, required: true, maxlength: 80 },
  entityId: { type: String, required: true, maxlength: 80 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })
coachingAuditEventSchema.index({ centerId: 1, createdAt: -1 })

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
export const CoachingClassSession = mongoose.models.CoachingClassSession
  ?? mongoose.model('CoachingClassSession', coachingClassSessionSchema)
export const CoachingFeeRecord = mongoose.models.CoachingFeeRecord
  ?? mongoose.model('CoachingFeeRecord', coachingFeeRecordSchema)
export const CoachingFeePlan = mongoose.models.CoachingFeePlan
  ?? mongoose.model('CoachingFeePlan', coachingFeePlanSchema)
export const CoachingGuardianContact = mongoose.models.CoachingGuardianContact
  ?? mongoose.model('CoachingGuardianContact', coachingGuardianContactSchema)
export const CoachingWhatsAppMessage = mongoose.models.CoachingWhatsAppMessage
  ?? mongoose.model('CoachingWhatsAppMessage', coachingWhatsAppMessageSchema)
export const CoachingAuditEvent = mongoose.models.CoachingAuditEvent
  ?? mongoose.model('CoachingAuditEvent', coachingAuditEventSchema)
export const CoachingExam = mongoose.models.CoachingExam ?? mongoose.model('CoachingExam', coachingExamSchema)
export const CoachingExamResult = mongoose.models.CoachingExamResult
  ?? mongoose.model('CoachingExamResult', coachingExamResultSchema)
export const CoachingNotice = mongoose.models.CoachingNotice ?? mongoose.model('CoachingNotice', coachingNoticeSchema)
export const CoachingNoticeRead = mongoose.models.CoachingNoticeRead
  ?? mongoose.model('CoachingNoticeRead', coachingNoticeReadSchema)
