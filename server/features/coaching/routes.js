import express from 'express'
import process from 'node:process'
import mongoose from 'mongoose'
import { firebaseAdminAuth } from '../../config/firebaseAdmin.js'
import {
  CoachingBatch,
  CoachingAttendance,
  CoachingAuditEvent,
  CoachingClassSession,
  CoachingCenter,
  CoachingCenterRequest,
  CoachingExam,
  CoachingExamResult,
  CoachingEnrollment,
  CoachingFeePlan,
  CoachingFeeRecord,
  CoachingGuardianContact,
  CoachingMembership,
  CoachingNotice,
  CoachingNoticeRead,
  CoachingStudent,
  CoachingTeacher,
  CoachingWhatsAppMessage,
} from '../../models/coaching.js'

const router = express.Router()
const managementRoles = ['owner', 'manager']
const membershipRoles = ['owner', 'manager', 'teacher', 'student', 'accountant']
const admissionTextFields = {
  englishName: 120,
  fatherName: 120,
  motherName: 120,
  permanentDistrict: 100,
  permanentPostOffice: 100,
  permanentVillage: 100,
  permanentArea: 100,
  presentDistrict: 100,
  presentPostOffice: 100,
  presentVillage: 100,
  presentArea: 100,
  guardianDistrict: 100,
  guardianPostOffice: 100,
  guardianVillage: 100,
  guardianArea: 100,
  nationality: 80,
  religion: 80,
  previousGrade: 40,
}

function serialize(document) {
  if (!document) return document
  const result = { ...document, id: String(document._id) }
  delete result._id
  delete result.__v
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) => item && typeof item === 'object' && item._id ? serialize(item) : item)
    } else if (value && typeof value === 'object' && value._id) {
      result[key] = serialize(value)
    }
  }
  return result
}

function requirePlatformAdmin(request, response, next) {
  if (request.firebaseUser?.role !== 'admin') {
    return response.status(403).json({ error: 'Platform admin role required' })
  }
  next()
}

async function requireCenterMembership(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.centerId)) {
      return response.status(400).json({ error: 'Invalid coaching center' })
    }
    const [membership, center] = await Promise.all([
      CoachingMembership.findOne({
        centerId: request.params.centerId,
        userId: request.firebaseUser.uid,
        status: 'active',
      }).lean(),
      CoachingCenter.findOne({ _id: request.params.centerId, status: 'active' }).lean(),
    ])
    if (!membership || !center) return response.status(403).json({ error: 'Active membership in this coaching center is required' })
    request.coachingMembership = membership
    request.coachingCenter = center
    next()
  } catch (error) {
    next(error)
  }
}

async function findOptionalFirebaseAccount(email) {
  if (!email) return null
  try {
    return await firebaseAdminAuth.getUserByEmail(email)
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null
    throw error
  }
}

function requireCenterRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.coachingMembership?.role)) {
      return response.status(403).json({ error: `This action requires ${roles.join(' or ')} center role` })
    }
    next()
  }
}

function normalizeRequiredString(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} must contain 1-${maxLength} characters`)
  }
  return value.trim()
}

function normalizeEmail(value, { required = false, label = 'Email' } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    if (required) throw new Error(`${label} is required`)
    return ''
  }

  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${label} must be a valid email address`)
  }
  return email
}

function normalizePhotoURL(value) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const url = value.trim()
  if (url.length > 500) throw new Error('Student photo URL cannot exceed 500 characters')
  let parsedURL
  try {
    parsedURL = new URL(url)
  } catch {
    throw new Error('Student photo URL must be a valid HTTPS URL')
  }
  if (parsedURL.protocol !== 'https:') {
    throw new Error('Student photo URL must be a valid HTTPS URL')
  }
  return url
}

function normalizeOptionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new Error(`Student ${field} must be at most ${maxLength} characters`)
  }
  return value.trim()
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isTodayOrEarlier(value) {
  const todayParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const today = ['year', 'month', 'day']
    .map((type) => todayParts.find((part) => part.type === type)?.value)
    .join('-')
  return value <= today
}

function isFeeMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function dhakaDateValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-')
}

function monthAfter(value, offset = 1) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function normalizeWhatsAppPhone(value) {
  const compact = String(value ?? '').replace(/[\s()-]/g, '')
  if (/^01[3-9]\d{8}$/.test(compact)) return `880${compact.slice(1)}`
  if (/^\+8801[3-9]\d{8}$/.test(compact)) return compact.slice(1)
  if (/^8801[3-9]\d{8}$/.test(compact)) return compact
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact.slice(1)
  if (/^[1-9]\d{7,14}$/.test(compact)) return compact
  return ''
}

async function getFeeDueRows(centerId, month, asOfDate = dhakaDateValue(), studentIdFilter = null) {
  const plans = await CoachingFeePlan.find({
    centerId,
    ...(studentIdFilter ? { studentId: { $in: studentIdFilter } } : {}),
  })
    .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode guardianName guardianPhone guardianWhatsAppOptIn' })
    .sort({ startsMonth: 1 })
    .lean()
  const activePlans = plans.filter((plan) => plan.studentId && plan.startsMonth <= month)
  const plansByStudent = new Map()
  for (const plan of activePlans) {
    const key = String(plan.studentId._id)
    const studentPlans = plansByStudent.get(key) ?? []
    studentPlans.push(plan)
    plansByStudent.set(key, studentPlans)
  }
  const studentIds = [...plansByStudent.values()].map((studentPlans) => studentPlans[0].studentId._id)
  const payments = studentIds.length
    ? await CoachingFeeRecord.aggregate([
        { $match: { centerId: new mongoose.Types.ObjectId(String(centerId)), studentId: { $in: studentIds }, category: 'tuition', feeMonth: { $lte: month }, status: { $ne: 'voided' } } },
        { $group: { _id: { studentId: '$studentId', feeMonth: '$feeMonth' }, paid: { $sum: '$amount' } } },
      ])
    : []
  const paidByStudent = new Map()
  for (const payment of payments) {
    const studentId = String(payment._id.studentId)
    const paidByMonth = paidByStudent.get(studentId) ?? new Map()
    paidByMonth.set(payment._id.feeMonth, payment.paid)
    paidByStudent.set(studentId, paidByMonth)
  }
  const rows = [...plansByStudent.entries()].map(([studentId, studentPlans]) => {
    const charges = new Map()
    studentPlans.forEach((plan, index) => {
      const nextPlan = studentPlans[index + 1]
      const lastMonth = nextPlan ? monthAfter(nextPlan.startsMonth, -1) : month
      if (lastMonth < plan.startsMonth) return
      let chargeMonth = plan.startsMonth
      while (chargeMonth <= lastMonth) {
        charges.set(chargeMonth, { amount: plan.monthlyAmount, dueDay: plan.dueDay })
        chargeMonth = monthAfter(chargeMonth)
      }
    })
    const paidByMonth = paidByStudent.get(studentId) ?? new Map()
    let billed = 0
    let paid = 0
    let due = 0
    let overdue = 0
    let credit = 0
    let nextDueDate = ''
    for (const [chargeMonth, charge] of charges) {
      const monthPaid = paidByMonth.get(chargeMonth) ?? 0
      const monthDue = Math.max(0, charge.amount - monthPaid)
      billed += charge.amount
      paid += monthPaid
      due += monthDue
      credit += Math.max(0, monthPaid - charge.amount)
      const dueDate = `${chargeMonth}-${String(charge.dueDay).padStart(2, '0')}`
      if (dueDate <= asOfDate) overdue += monthDue
      else if (monthDue && !nextDueDate) nextDueDate = dueDate
    }
    const currentPlan = [...studentPlans].reverse().find((plan) => plan.startsMonth <= month)
    return {
      id: String(currentPlan._id),
      student: serialize(currentPlan.studentId),
      monthlyAmount: currentPlan.monthlyAmount,
      startsMonth: currentPlan.startsMonth,
      dueDay: currentPlan.dueDay,
      billed,
      paid,
      due,
      overdue,
      notYetDue: Math.max(0, due - overdue),
      credit,
      nextDueDate,
    }
  })
  return {
    rows,
    totalDue: rows.reduce((total, row) => total + row.due, 0),
    totalOverdue: rows.reduce((total, row) => total + row.overdue, 0),
    studentsWithDue: rows.filter((row) => row.due > 0).length,
    overdueStudents: rows.filter((row) => row.overdue > 0).length,
  }
}

async function teacherCanAccessBatch(batch, membership, userId, centerId) {
  if (membership.role !== 'teacher') return true
  return Boolean(batch.teacherId && await CoachingTeacher.exists({
    _id: batch.teacherId,
    centerId,
    linkedUserId: userId,
    status: 'active',
  }))
}

async function hasClassScheduleConflict({ centerId, batch, date, startTime, endTime, excludeSessionId }) {
  const relatedBatchIds = await CoachingBatch.find({
    centerId,
    status: 'active',
    ...(batch.teacherId ? { teacherId: batch.teacherId } : { _id: batch._id }),
  }).distinct('_id')
  const conflict = await CoachingClassSession.exists({
    centerId,
    batchId: { $in: relatedBatchIds },
    date,
    status: 'scheduled',
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    ...(excludeSessionId ? { _id: { $ne: excludeSessionId } } : {}),
  })
  return Boolean(conflict)
}

async function getMemberStudentIds(centerId, userId) {
  return CoachingStudent.find({ centerId, linkedUserId: userId, status: 'active' }).distinct('_id')
}

async function getMemberBatchIds(centerId, membership) {
  if (membership.role === 'teacher') {
    const teacherIds = await CoachingTeacher.find({
      centerId,
      linkedUserId: membership.userId,
      status: 'active',
    }).distinct('_id')
    return CoachingBatch.find({ centerId, teacherId: { $in: teacherIds }, status: 'active' }).distinct('_id')
  }
  if (membership.role === 'student') {
    const studentIds = await getMemberStudentIds(centerId, membership.userId)
    return CoachingEnrollment.find({ centerId, studentId: { $in: studentIds }, status: 'active' }).distinct('batchId')
  }
  return null
}

router.get('/centers', async (request, response, next) => {
  try {
    const memberships = await CoachingMembership.find({ userId: request.firebaseUser.uid, status: 'active' })
      .populate({ path: 'centerId', match: { status: 'active' }, select: 'name address contactPhone status' })
      .lean()
    response.json(memberships
      .filter((membership) => membership.centerId)
      .map((membership) => ({
        ...serialize(membership.centerId),
        role: membership.role,
        membershipId: String(membership._id),
      })))
  } catch (error) {
    next(error)
  }
})

router.post('/center-requests', async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Center name', 120)
    const address = typeof request.body?.address === 'string' ? request.body.address.trim().slice(0, 300) : ''
    const contactPhone = typeof request.body?.contactPhone === 'string' ? request.body.contactPhone.trim().slice(0, 30) : ''
    const existingPending = await CoachingCenterRequest.exists({
      requesterId: request.firebaseUser.uid,
      status: 'pending',
    })
    if (existingPending) return response.status(409).json({ error: 'You already have a pending coaching center request' })
    const centerRequest = await CoachingCenterRequest.create({
      name,
      address,
      contactPhone,
      requesterId: request.firebaseUser.uid,
      requesterName: request.firebaseUser.name ?? '',
      requesterEmail: request.firebaseUser.email ?? '',
      requesterPhotoURL: request.firebaseUser.picture ?? '',
    })
    response.status(201).json(serialize(centerRequest.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'You already have a pending coaching center request' })
    if (error instanceof Error && error.message.startsWith('Center name')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.get('/center-requests/mine', async (request, response, next) => {
  try {
    const centerRequests = await CoachingCenterRequest.find({ requesterId: request.firebaseUser.uid })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    response.json(centerRequests.map(serialize))
  } catch (error) {
    next(error)
  }
})

router.get('/admin/center-requests', requirePlatformAdmin, async (_request, response, next) => {
  try {
    const centerRequests = await CoachingCenterRequest.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean()
    response.json(centerRequests.map(serialize))
  } catch (error) {
    next(error)
  }
})

router.post('/admin/center-requests/:requestId/decision', requirePlatformAdmin, async (request, response, next) => {
  let centerRequest
  try {
    if (!mongoose.isValidObjectId(request.params.requestId)) {
      return response.status(400).json({ error: 'Invalid coaching center request' })
    }
    const { decision } = request.body ?? {}
    if (!['approve', 'reject'].includes(decision)) {
      return response.status(400).json({ error: 'Decision must be approve or reject' })
    }
    if (decision === 'reject') {
      centerRequest = await CoachingCenterRequest.findOneAndUpdate(
        { _id: request.params.requestId, status: 'pending' },
        { $set: { status: 'rejected', reviewedBy: request.firebaseUser.uid, reviewedAt: new Date() } },
        { new: true },
      )
      if (!centerRequest) return response.status(404).json({ error: 'Pending coaching center request not found' })
      return response.json(serialize(centerRequest.toObject()))
    }

    centerRequest = await CoachingCenterRequest.findOneAndUpdate(
      { _id: request.params.requestId, status: 'pending' },
      { $set: { status: 'processing', reviewedBy: request.firebaseUser.uid } },
      { new: true },
    )
    if (!centerRequest) return response.status(404).json({ error: 'Pending coaching center request not found' })

    const center = centerRequest.centerId
      ? await CoachingCenter.findById(centerRequest.centerId)
      : await CoachingCenter.create({
          name: centerRequest.name,
          address: centerRequest.address,
          contactPhone: centerRequest.contactPhone,
          createdBy: centerRequest.requesterId,
        })
    await CoachingCenterRequest.updateOne(
      { _id: centerRequest._id, status: 'processing' },
      { $set: { centerId: center._id } },
    )
    await CoachingMembership.updateOne(
      { centerId: center._id, userId: centerRequest.requesterId },
      {
        $setOnInsert: {
          displayName: centerRequest.requesterName,
          email: centerRequest.requesterEmail,
          photoURL: centerRequest.requesterPhotoURL,
          role: 'owner',
          status: 'active',
        },
      },
      { upsert: true },
    )
    const approvedRequest = await CoachingCenterRequest.findOneAndUpdate(
      { _id: centerRequest._id, status: 'processing' },
      { $set: { status: 'approved', centerId: center._id, reviewedAt: new Date() } },
      { new: true },
    )
    response.json({ request: serialize(approvedRequest.toObject()), center: serialize(center.toObject()) })
  } catch (error) {
    if (centerRequest?._id) {
      await CoachingCenterRequest.updateOne(
        { _id: centerRequest._id, status: 'processing' },
        { $set: { status: 'pending' } },
      ).catch((restoreError) => console.error('Could not restore a failed coaching center request', restoreError))
    }
    next(error)
  }
})

router.get('/centers/:centerId/overview', requireCenterMembership, async (request, response, next) => {
  try {
    const { centerId, userId } = request.coachingMembership
    const role = request.coachingMembership.role
    const [teachers, students, batches] = await Promise.all([
      ['owner', 'manager', 'accountant'].includes(role)
        ? CoachingTeacher.find({ centerId, status: 'active' }).sort({ name: 1 }).lean()
        : role === 'teacher'
          ? CoachingTeacher.find({ centerId, linkedUserId: userId, status: 'active' }).lean()
          : [],
      ['owner', 'manager', 'accountant'].includes(role)
        ? CoachingStudent.find({ centerId, status: 'active' }).sort({ name: 1 }).lean()
        : role === 'student'
          ? CoachingStudent.find({ centerId, linkedUserId: userId, status: 'active' }).lean()
          : [],
      role === 'student'
        ? CoachingEnrollment.find({ centerId, studentId: { $in: await CoachingStudent.find({ centerId, linkedUserId: userId }).distinct('_id') }, status: 'active' })
            .populate({ path: 'batchId', match: { status: 'active' } }).lean()
            .then((enrollments) => enrollments.map((enrollment) => enrollment.batchId).filter(Boolean))
        : role === 'teacher'
          ? CoachingBatch.find({
              centerId,
              teacherId: { $in: await CoachingTeacher.find({ centerId, linkedUserId: userId }).distinct('_id') },
              status: 'active',
            }).populate({ path: 'teacherId', select: 'name email' }).sort({ name: 1 }).lean()
          : CoachingBatch.find({ centerId, status: 'active' })
              .populate({ path: 'teacherId', select: 'name email' }).sort({ name: 1 }).lean(),
    ])
    const enrollments = managementRoles.includes(role)
      ? await CoachingEnrollment.find({ centerId })
          .populate({ path: 'studentId', select: 'name studentCode' })
          .populate({ path: 'batchId', select: 'name' })
          .sort({ updatedAt: -1 })
          .limit(500)
          .lean()
      : []
    const members = await CoachingMembership.find({
      centerId,
      ...(managementRoles.includes(role) ? {} : { userId, status: 'active' }),
    }).sort({ role: 1, displayName: 1 }).lean()
    response.json({
      center: serialize(request.coachingCenter),
      role,
      members: members.map(serialize),
      teachers: teachers.map(serialize),
      students: students.map(serialize),
      batches: batches.map(serialize),
      enrollments: enrollments.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/dashboard', requireCenterMembership, async (request, response, next) => {
  try {
    const { centerId, role } = request.coachingMembership
    const today = dhakaDateValue()
    const tillDateValue = new Date(`${today}T00:00:00.000Z`)
    tillDateValue.setUTCDate(tillDateValue.getUTCDate() + 30)
    const tillDate = tillDateValue.toISOString().slice(0, 10)
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const scopedBatches = batchIds ? { batchId: { $in: batchIds } } : {}
    const [todaySessions, upcomingSessions, upcomingExams, dueSummary] = await Promise.all([
      CoachingClassSession.find({ centerId, date: today, status: 'scheduled', ...scopedBatches })
        .populate({ path: 'batchId', select: 'name subject teacherId', populate: { path: 'teacherId', select: 'name' } })
        .sort({ startTime: 1 }).limit(100).lean(),
      CoachingClassSession.find({ centerId, date: { $gt: today, $lte: tillDate }, status: 'scheduled', ...scopedBatches })
        .populate({ path: 'batchId', select: 'name subject teacherId', populate: { path: 'teacherId', select: 'name' } })
        .sort({ date: 1, startTime: 1 }).limit(100).lean(),
      ['owner', 'manager', 'teacher', 'student'].includes(role)
        ? CoachingExam.find({
            centerId,
            status: 'active',
            examDate: { $gte: today, $lte: tillDate },
            ...(batchIds ? { batchId: { $in: batchIds } } : {}),
          }).populate({ path: 'batchId', select: 'name subject' }).sort({ examDate: 1 }).limit(50).lean()
        : Promise.resolve([]),
      ['owner', 'manager', 'accountant'].includes(role)
        ? getFeeDueRows(centerId, today.slice(0, 7), today)
        : Promise.resolve(null),
    ])
    const sessionsWithAttendance = await Promise.all(todaySessions.map(async (session) => {
      const batchId = session.batchId?._id ?? session.batchId
      const enrolled = await CoachingEnrollment.countDocuments({ centerId, batchId, status: 'active' })
      const marked = await CoachingAttendance.countDocuments({ centerId, batchId, date: today })
      return { ...serialize(session), enrolled, marked, attendancePending: Math.max(0, enrolled - marked) }
    }))
    response.json({
      date: today,
      todaySessions: sessionsWithAttendance,
      upcomingSessions: upcomingSessions.map(serialize),
      upcomingExams: upcomingExams.map(serialize),
      due: dueSummary ? {
        total: dueSummary.totalDue,
        overdue: dueSummary.totalOverdue,
        students: dueSummary.studentsWithDue,
        overdueStudents: dueSummary.overdueStudents,
      } : null,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/members', requireCenterMembership, requireCenterRoles('owner', 'manager'), async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email, { required: true, label: 'Member email' })
    const role = request.body?.role
    if (!membershipRoles.includes(role)
      || (['owner', 'manager'].includes(role) && request.coachingMembership.role !== 'owner')) {
      return response.status(400).json({ error: 'Choose a valid center role; only the owner can assign another owner' })
    }
    const account = await firebaseAdminAuth.getUserByEmail(email)
    if (account.disabled) return response.status(409).json({ error: 'A disabled Firebase account cannot be added' })
    const member = await CoachingMembership.findOneAndUpdate(
      { centerId: request.params.centerId, userId: account.uid },
      { $set: { role, status: 'active', email: account.email ?? email, displayName: account.displayName ?? '', photoURL: account.photoURL ?? '' } },
      { new: true, upsert: true, runValidators: true },
    )
    const linkedTeacher = await CoachingTeacher.findOne({ centerId: request.params.centerId, email }).lean()
    if (linkedTeacher) await CoachingTeacher.updateOne({ _id: linkedTeacher._id }, { $set: { linkedUserId: account.uid } })
    const linkedStudent = await CoachingStudent.findOne({ centerId: request.params.centerId, email }).lean()
    if (linkedStudent) await CoachingStudent.updateOne({ _id: linkedStudent._id }, { $set: { linkedUserId: account.uid } })
    response.status(201).json({
      id: String(member._id),
      uid: account.uid,
      email: account.email,
      displayName: account.displayName ?? '',
      role: member.role,
    })
  } catch (error) {
    if (error.code === 'auth/user-not-found') return response.status(404).json({ error: 'No Firebase account was found for this email' })
    if (error instanceof Error && error.message.startsWith('Member email')) return response.status(400).json({ error: error.message })
    if (error.code === 11000) return response.status(409).json({ error: 'This account already belongs to the coaching center' })
    next(error)
  }
})

router.patch('/centers/:centerId/members/:userId', requireCenterMembership, requireCenterRoles('owner', 'manager'), async (request, response, next) => {
  try {
    const targetUserId = normalizeRequiredString(request.params.userId, 'Member account ID', 128)
    if (targetUserId === request.firebaseUser.uid) {
      return response.status(409).json({ error: 'You cannot change your own coaching membership' })
    }
    const member = await CoachingMembership.findOne({
      centerId: request.params.centerId,
      userId: targetUserId,
    })
    if (!member) return response.status(404).json({ error: 'Coaching center member not found' })

    const { role, status } = request.body ?? {}
    if (role !== undefined && !membershipRoles.includes(role)) {
      return response.status(400).json({ error: 'Choose a valid coaching center role' })
    }
    if (status !== undefined && !['active', 'suspended'].includes(status)) {
      return response.status(400).json({ error: 'Member status must be active or suspended' })
    }
    if (request.coachingMembership.role !== 'owner'
      && (['owner', 'manager'].includes(member.role) || role === 'owner' || role === 'manager')) {
      return response.status(403).json({ error: 'Only the center owner can manage owner or manager roles' })
    }
    if (member.role === 'owner'
      && ((role !== undefined && role !== 'owner') || status === 'suspended')) {
      const activeOwners = await CoachingMembership.countDocuments({
        centerId: request.params.centerId,
        role: 'owner',
        status: 'active',
      })
      if (activeOwners <= 1) return response.status(409).json({ error: 'The last active center owner cannot be removed or demoted' })
    }

    if (role !== undefined) member.role = role
    if (status !== undefined) member.status = status
    await member.save()
    response.json(serialize(member.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Member account ID')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/students', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { name, studentCode, grade } = request.body ?? {}
    const normalizedName = normalizeRequiredString(name, 'Student name', 120)
    const normalizedCode = normalizeRequiredString(studentCode, 'Student ID', 40)
    const normalizedGrade = Number(grade)
    if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 12) {
      return response.status(400).json({ error: 'Student grade must be between 1 and 12' })
    }
    if (request.body.dateOfBirth && !isCalendarDate(request.body.dateOfBirth)) {
      return response.status(400).json({ error: 'Provide date of birth in YYYY-MM-DD format' })
    }
    const email = normalizeEmail(request.body.email)
    const account = await findOptionalFirebaseAccount(email)
    const guardianPhone = typeof request.body.guardianPhone === 'string' ? request.body.guardianPhone.trim().slice(0, 30) : ''
    const guardianWhatsAppOptIn = request.body.guardianWhatsAppOptIn === true
    if (request.body.guardianWhatsAppOptIn !== undefined && typeof request.body.guardianWhatsAppOptIn !== 'boolean') {
      return response.status(400).json({ error: 'WhatsApp consent must be true or false' })
    }
    if (guardianWhatsAppOptIn && !guardianPhone) {
      return response.status(400).json({ error: 'Add a guardian phone number before recording WhatsApp consent' })
    }
    const student = await CoachingStudent.create({
      centerId: request.params.centerId,
      name: normalizedName,
      studentCode: normalizedCode,
      ...Object.fromEntries(Object.entries(admissionTextFields).map(([field, maxLength]) => [
        field,
        normalizeOptionalString(request.body[field], field, maxLength),
      ])),
      grade: normalizedGrade,
      phone: typeof request.body.phone === 'string' ? request.body.phone.trim().slice(0, 30) : '',
      email,
      linkedUserId: account?.uid ?? '',
      guardianName: typeof request.body.guardianName === 'string' ? request.body.guardianName.trim().slice(0, 120) : '',
      guardianPhone,
      guardianWhatsAppOptIn,
      ...(guardianWhatsAppOptIn ? {
        guardianWhatsAppOptInAt: new Date(),
        guardianWhatsAppOptInBy: request.firebaseUser.uid,
      } : {}),
      dateOfBirth: request.body.dateOfBirth || '',
      photoURL: normalizePhotoURL(request.body.photoURL),
      createdBy: request.firebaseUser.uid,
    })
    if (guardianWhatsAppOptIn) {
      await CoachingAuditEvent.create({
        centerId: request.params.centerId,
        actorId: request.firebaseUser.uid,
        action: 'whatsapp.consent-recorded',
        entityType: 'student',
        entityId: String(student._id),
        details: { optIn: true },
      })
    }
    response.status(201).json(serialize(student.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This student ID is already used in the center' })
    if (error instanceof Error && error.message.startsWith('Student name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student ID')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Email')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student photo URL')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Student ')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/students/:studentId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId } = request.params
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Invalid student profile' })
    const student = await CoachingStudent.findOne({ _id: studentId, centerId: request.params.centerId, status: 'active' })
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })

    const { name, studentCode, grade, phone, email, guardianName, guardianPhone, photoURL, dateOfBirth } = request.body ?? {}
    if (name !== undefined) student.name = normalizeRequiredString(name, 'Student name', 120)
    if (studentCode !== undefined) student.studentCode = normalizeRequiredString(studentCode, 'Student ID', 40)
    for (const [field, maxLength] of Object.entries(admissionTextFields)) {
      if (request.body[field] !== undefined) student[field] = normalizeOptionalString(request.body[field], field, maxLength)
    }
    if (grade !== undefined) {
      const normalizedGrade = Number(grade)
      if (!Number.isInteger(normalizedGrade) || normalizedGrade < 1 || normalizedGrade > 12) {
        return response.status(400).json({ error: 'Student grade must be between 1 and 12' })
      }
      student.grade = normalizedGrade
    }
    if (phone !== undefined) student.phone = typeof phone === 'string' ? phone.trim().slice(0, 30) : ''
    if (email !== undefined) {
      student.email = normalizeEmail(email)
      const account = await findOptionalFirebaseAccount(student.email)
      student.linkedUserId = account?.uid ?? ''
    }
    if (guardianName !== undefined) student.guardianName = typeof guardianName === 'string' ? guardianName.trim().slice(0, 120) : ''
    const previousGuardianPhone = student.guardianPhone
    if (guardianPhone !== undefined) student.guardianPhone = typeof guardianPhone === 'string' ? guardianPhone.trim().slice(0, 30) : ''
    if (student.guardianPhone !== previousGuardianPhone && request.body.guardianWhatsAppOptIn !== true) {
      student.guardianWhatsAppOptIn = false
      student.guardianWhatsAppOptOutAt = new Date()
    }
    if (request.body.guardianWhatsAppOptIn !== undefined) {
      if (typeof request.body.guardianWhatsAppOptIn !== 'boolean') {
        return response.status(400).json({ error: 'WhatsApp consent must be true or false' })
      }
      if (request.body.guardianWhatsAppOptIn && !student.guardianPhone) {
        return response.status(400).json({ error: 'Add a guardian phone number before recording WhatsApp consent' })
      }
      if (student.guardianWhatsAppOptIn !== request.body.guardianWhatsAppOptIn) {
        student.guardianWhatsAppOptIn = request.body.guardianWhatsAppOptIn
        if (request.body.guardianWhatsAppOptIn) {
          student.guardianWhatsAppOptInAt = new Date()
          student.guardianWhatsAppOptInBy = request.firebaseUser.uid
          student.guardianWhatsAppOptOutAt = undefined
        } else {
          student.guardianWhatsAppOptOutAt = new Date()
        }
      }
    }
    if (dateOfBirth !== undefined) {
      if (dateOfBirth && !isCalendarDate(dateOfBirth)) return response.status(400).json({ error: 'Provide date of birth in YYYY-MM-DD format' })
      student.dateOfBirth = dateOfBirth || ''
    }
    if (photoURL !== undefined) student.photoURL = normalizePhotoURL(photoURL)
    await student.save()
    if (request.body.guardianWhatsAppOptIn !== undefined) {
      await CoachingAuditEvent.create({
        centerId: request.params.centerId,
        actorId: request.firebaseUser.uid,
        action: request.body.guardianWhatsAppOptIn ? 'whatsapp.consent-recorded' : 'whatsapp.consent-withdrawn',
        entityType: 'student',
        entityId: String(student._id),
        details: { optIn: student.guardianWhatsAppOptIn },
      })
    }
    response.json(serialize(student.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This student ID is already used in the center' })
    if (error instanceof Error && ['Student name', 'Student ID', 'Email', 'Student photo URL', 'Student '].some((prefix) => error.message.startsWith(prefix))) {
      return response.status(400).json({ error: error.message })
    }
    next(error)
  }
})

router.get('/centers/:centerId/students/:studentId/summary', requireCenterMembership, async (request, response, next) => {
  try {
    const { studentId } = request.params
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Invalid student profile' })
    const { centerId, role, userId } = request.coachingMembership
    const student = await CoachingStudent.findOne({ _id: studentId, centerId, status: 'active' }).lean()
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })

    const canManage = managementRoles.includes(role)
    const canSeeFinance = canManage || role === 'accountant'
    let enrollments
    if (role === 'student') {
      if (student.linkedUserId !== userId) return response.status(403).json({ error: 'You can only view your own student profile' })
      enrollments = await CoachingEnrollment.find({ centerId, studentId }).populate({ path: 'batchId', select: 'name subject grade schedule' }).sort({ updatedAt: -1 }).lean()
    } else if (role === 'teacher') {
      const permittedBatchIds = await getMemberBatchIds(centerId, request.coachingMembership)
      enrollments = await CoachingEnrollment.find({ centerId, studentId, batchId: { $in: permittedBatchIds } })
        .populate({ path: 'batchId', select: 'name subject grade schedule' })
        .sort({ updatedAt: -1 })
        .lean()
      if (!enrollments.length) return response.status(403).json({ error: 'This student is not in one of your assigned batches' })
    } else {
      enrollments = await CoachingEnrollment.find({ centerId, studentId })
        .populate({ path: 'batchId', select: 'name subject grade schedule' })
        .sort({ updatedAt: -1 })
        .lean()
    }

    const today = dhakaDateValue()
    const sinceDateValue = new Date(`${today}T00:00:00.000Z`)
    sinceDateValue.setUTCDate(sinceDateValue.getUTCDate() - 89)
    const sinceDate = sinceDateValue.toISOString().slice(0, 10)
    const batchIds = enrollments.map((enrollment) => enrollment.batchId?._id).filter(Boolean)
    const attendanceFilter = {
      centerId,
      studentId,
      date: { $gte: sinceDate, $lte: today },
      ...(role === 'teacher' ? { batchId: { $in: batchIds } } : {}),
    }
    const [attendanceRecords, attendanceTotals] = await Promise.all([
      CoachingAttendance.find(attendanceFilter)
      .populate({ path: 'batchId', select: 'name subject' })
      .sort({ date: -1 })
      .limit(100)
      .lean(),
      CoachingAttendance.aggregate([
        { $match: attendanceFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ])
    const attendance = {
      records: attendanceRecords.map(serialize),
      totals: attendanceTotals.reduce((totals, item) => {
        totals[item._id] = item.count
        return totals
      }, { present: 0, absent: 0, late: 0, excused: 0 }),
      since: sinceDate,
      to: today,
    }
    const examResults = await CoachingExamResult.find({
      centerId,
      studentId,
      ...(role === 'teacher' ? { batchId: { $in: batchIds } } : {}),
    })
      .populate({ path: 'examId', select: 'title examDate totalMarks status' })
      .populate({ path: 'batchId', select: 'name subject grade' })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
    const feeSummary = canSeeFinance
      ? await getFeeDueRows(centerId, today.slice(0, 7), today, [student._id])
      : null
    const contacts = canManage
      ? await CoachingGuardianContact.find({ centerId, studentId }).sort({ contactedAt: -1 }).limit(50).lean()
      : []
    const visibleStudent = serialize(student)
    if (role === 'teacher') {
      delete visibleStudent.guardianName
      delete visibleStudent.guardianPhone
      delete visibleStudent.guardianWhatsAppOptIn
      delete visibleStudent.guardianWhatsAppOptInAt
      delete visibleStudent.guardianWhatsAppOptInBy
      delete visibleStudent.guardianWhatsAppOptOutAt
      delete visibleStudent.guardianDistrict
      delete visibleStudent.guardianPostOffice
      delete visibleStudent.guardianVillage
      delete visibleStudent.guardianArea
    }
    response.json({
      student: visibleStudent,
      enrollments: enrollments.map(serialize),
      attendance,
      examResults: examResults.map(serialize),
      fees: feeSummary?.rows[0] ?? null,
      contacts: contacts.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/centers/:centerId/students/:studentId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId } = request.params
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Invalid student profile' })
    const student = await CoachingStudent.findOneAndUpdate(
      { _id: studentId, centerId: request.params.centerId, status: 'active' },
      { $set: { status: 'inactive' } },
      { new: true, runValidators: true },
    )
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })
    const activeEnrollments = await CoachingEnrollment.find(
      { centerId: request.params.centerId, studentId, status: 'active' },
    ).select('_id batchId').lean()
    await CoachingEnrollment.updateMany(
      { centerId: request.params.centerId, studentId, status: 'active' },
      {
        $set: { status: 'withdrawn' },
        $push: {
          history: {
            action: 'withdrawn',
            note: 'Student profile deactivated',
            changedBy: request.firebaseUser.uid,
          },
        },
      },
    )
    if (activeEnrollments.length) {
      await CoachingAuditEvent.create({
        centerId: request.params.centerId,
        actorId: request.firebaseUser.uid,
        action: 'student.deactivated',
        entityType: 'student',
        entityId: String(student._id),
        details: { withdrawnEnrollments: activeEnrollments.map((enrollment) => String(enrollment._id)) },
      })
    }
    response.json({ id: String(student._id), status: student.status })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/teachers', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Teacher name', 120)
    const email = normalizeEmail(request.body?.email)
    const account = await findOptionalFirebaseAccount(email)
    const subjects = Array.isArray(request.body?.subjects)
      ? request.body.subjects.filter((subject) => typeof subject === 'string').map((subject) => subject.trim()).filter(Boolean).slice(0, 20)
      : []
    const teacher = await CoachingTeacher.create({
      centerId: request.params.centerId,
      name,
      phone: typeof request.body?.phone === 'string' ? request.body.phone.trim().slice(0, 30) : '',
      email,
      linkedUserId: account?.uid ?? '',
      subjects,
      createdBy: request.firebaseUser.uid,
    })
    response.status(201).json(serialize(teacher.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Teacher name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Email')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/batches', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const name = normalizeRequiredString(request.body?.name, 'Batch name', 120)
    const subject = normalizeRequiredString(request.body?.subject, 'Batch subject', 80)
    const grade = Number(request.body?.grade)
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) {
      return response.status(400).json({ error: 'Batch grade must be between 1 and 12' })
    }
    let teacherId = null
    if (request.body?.teacherId) {
      if (!mongoose.isValidObjectId(request.body.teacherId)) return response.status(400).json({ error: 'Invalid teacher profile' })
      const teacher = await CoachingTeacher.exists({
        _id: request.body.teacherId,
        centerId: request.params.centerId,
        status: 'active',
      })
      if (!teacher) return response.status(404).json({ error: 'Active teacher profile not found in this center' })
      teacherId = request.body.teacherId
    }
    const batch = await CoachingBatch.create({
      centerId: request.params.centerId,
      name,
      grade,
      subject,
      teacherId,
      schedule: typeof request.body?.schedule === 'string' ? request.body.schedule.trim().slice(0, 300) : '',
      createdBy: request.firebaseUser.uid,
    })
    const populatedBatch = await CoachingBatch.findById(batch._id).populate({ path: 'teacherId', select: 'name email' }).lean()
    response.status(201).json(serialize(populatedBatch))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Batch name')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Batch subject')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/batches/:batchId/enrollments', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { batchId } = request.params
    const { studentId } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId) || !mongoose.isValidObjectId(studentId)) {
      return response.status(400).json({ error: 'Provide valid batch and student IDs' })
    }
    const [batch, student] = await Promise.all([
      CoachingBatch.exists({ _id: batchId, centerId: request.params.centerId, status: 'active' }),
      CoachingStudent.exists({ _id: studentId, centerId: request.params.centerId, status: 'active' }),
    ])
    if (!batch || !student) return response.status(404).json({ error: 'Active batch or student not found in this center' })
    let enrollment = await CoachingEnrollment.findOne({ centerId: request.params.centerId, batchId, studentId })
    if (!enrollment) {
      enrollment = await CoachingEnrollment.create({
        centerId: request.params.centerId,
        batchId,
        studentId,
        status: 'active',
        enrolledAt: new Date(),
        history: [{ action: 'enrolled', changedBy: request.firebaseUser.uid }],
      })
    } else if (enrollment.status === 'withdrawn') {
      enrollment.status = 'active'
      enrollment.enrolledAt = new Date()
      enrollment.history.push({
        action: 'reactivated',
        note: typeof request.body?.note === 'string' ? request.body.note.trim().slice(0, 300) : '',
        changedBy: request.firebaseUser.uid,
      })
      await enrollment.save()
    }
    response.status(201).json(serialize(enrollment.toObject()))
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Student is already enrolled in this batch' })
    next(error)
  }
})

router.patch('/centers/:centerId/enrollments/:enrollmentId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { enrollmentId } = request.params
    const { status, note } = request.body ?? {}
    if (!mongoose.isValidObjectId(enrollmentId)) return response.status(400).json({ error: 'Invalid enrollment' })
    if (!['active', 'withdrawn'].includes(status)) return response.status(400).json({ error: 'Enrollment status must be active or withdrawn' })
    if (note !== undefined && (typeof note !== 'string' || note.trim().length > 300)) {
      return response.status(400).json({ error: 'Enrollment note cannot exceed 300 characters' })
    }
    const enrollment = await CoachingEnrollment.findOne({ _id: enrollmentId, centerId: request.params.centerId })
    if (!enrollment) return response.status(404).json({ error: 'Enrollment not found in this center' })
    if (enrollment.status !== status) {
      enrollment.status = status
      if (status === 'active') enrollment.enrolledAt = new Date()
      enrollment.history.push({
        action: status === 'withdrawn' ? 'withdrawn' : 'reactivated',
        note: note?.trim() ?? '',
        changedBy: request.firebaseUser.uid,
      })
      await enrollment.save()
      await CoachingAuditEvent.create({
        centerId: request.params.centerId,
        actorId: request.firebaseUser.uid,
        action: status === 'withdrawn' ? 'enrollment.withdrawn' : 'enrollment.reactivated',
        entityType: 'enrollment',
        entityId: String(enrollment._id),
        details: { studentId: String(enrollment.studentId), batchId: String(enrollment.batchId), note: note?.trim() ?? '' },
      })
    }
    response.json(serialize(enrollment.toObject()))
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/attendance', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId, date } = request.query
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    if (!isCalendarDate(date)) return response.status(400).json({ error: 'Provide a valid attendance date in YYYY-MM-DD format' })
    if (!isTodayOrEarlier(date)) return response.status(400).json({ error: 'Attendance cannot be viewed or recorded for a future date' })

    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only manage attendance for their assigned batches' })
    }

    const enrollments = await CoachingEnrollment.find({ centerId, batchId, status: 'active' })
      .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode' })
      .lean()
    const studentsById = new Map(enrollments
      .map((enrollment) => enrollment.studentId)
      .filter(Boolean)
      .map((student) => [String(student._id), student]))
    const attendance = await CoachingAttendance.find({ centerId, batchId, date })
      .populate({ path: 'studentId', select: 'name studentCode' })
      .lean()
    const attendanceByStudent = new Map(attendance
      .filter((record) => record.studentId)
      .map((record) => {
        const student = record.studentId
        studentsById.set(String(student._id), student)
        return [String(student._id), record.status]
      }))
    response.json({
      batch: serialize(batch),
      date,
      students: [...studentsById.values()].map((student) => ({
        id: String(student._id),
        name: student.name,
        studentCode: student.studentCode,
        status: attendanceByStudent.get(String(student._id)) ?? '',
        savedStatus: attendanceByStudent.get(String(student._id)) ?? '',
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/batches/:batchId/attendance', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId } = request.params
    const { date, entries } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    if (!isCalendarDate(date)) return response.status(400).json({ error: 'Provide a valid attendance date in YYYY-MM-DD format' })
    if (!isTodayOrEarlier(date)) return response.status(400).json({ error: 'Attendance cannot be recorded for a future date' })
    const validStatuses = ['present', 'absent', 'late', 'excused']
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
      return response.status(400).json({ error: 'Provide between 1 and 1,000 attendance entries' })
    }
    if (entries.some((entry) => !entry || !mongoose.isValidObjectId(entry.studentId) || !validStatuses.includes(entry.status))) {
      return response.status(400).json({ error: 'Each attendance entry must have a valid student and status' })
    }
    const normalizedEntries = entries.map((entry) => ({ studentId: String(entry.studentId).toLowerCase(), status: entry.status }))
    const studentIds = normalizedEntries.map((entry) => entry.studentId)
    if (new Set(studentIds).size !== studentIds.length) {
      return response.status(400).json({ error: 'A student can only appear once in an attendance submission' })
    }

    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only manage attendance for their assigned batches' })
    }
    const [enrolledIds, activeStudentIds] = await Promise.all([
      CoachingEnrollment.find({
        centerId,
        batchId,
        studentId: { $in: studentIds },
        status: 'active',
      }).distinct('studentId'),
      CoachingStudent.find({ centerId, _id: { $in: studentIds }, status: 'active' }).distinct('_id'),
    ])
    if (enrolledIds.length !== studentIds.length || activeStudentIds.length !== studentIds.length) {
      return response.status(400).json({ error: 'Attendance can only be recorded for students actively enrolled in this batch' })
    }

    await CoachingAttendance.bulkWrite(normalizedEntries.map((entry) => ({
      updateOne: {
        filter: { centerId, batchId, date, studentId: entry.studentId },
        update: { $set: { status: entry.status, markedBy: request.firebaseUser.uid } },
        upsert: true,
      },
    })))
    response.json({ saved: entries.length, date, batchId })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Attendance changed at the same time; reload and try again' })
    next(error)
  }
})

router.get('/centers/:centerId/fees', requireCenterMembership, requireCenterRoles(...managementRoles, 'accountant'), async (request, response, next) => {
  try {
    const month = request.query.month
    if (!isFeeMonth(month)) return response.status(400).json({ error: 'Provide a valid fee month in YYYY-MM format' })
    const { centerId } = request.coachingMembership
    const filter = { centerId, feeMonth: month }
    const [records, [summary = { count: 0, total: 0 }]] = await Promise.all([
      CoachingFeeRecord.find(filter)
        .populate({ path: 'studentId', select: 'name studentCode' })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(500)
        .lean(),
      CoachingFeeRecord.aggregate([
        { $match: { centerId: new mongoose.Types.ObjectId(String(centerId)), feeMonth: month, status: { $ne: 'voided' } } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
    ])
    response.json({
      month,
      total: summary.total,
      count: summary.count,
      truncated: summary.count > records.length,
      records: records.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/fees/due', requireCenterMembership, requireCenterRoles(...managementRoles, 'accountant'), async (request, response, next) => {
  try {
    const month = request.query.month
    if (!isFeeMonth(month)) return response.status(400).json({ error: 'Provide a valid fee month in YYYY-MM format' })
    const { centerId } = request.coachingMembership
    const dueSummary = await getFeeDueRows(centerId, month)
    response.json({
      month,
      ...dueSummary,
    })
  } catch (error) {
    next(error)
  }
})

router.put('/centers/:centerId/fees/plans', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId, monthlyAmount, startsMonth, dueDay = 10 } = request.body ?? {}
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    if (!Number.isSafeInteger(monthlyAmount) || monthlyAmount < 1 || monthlyAmount > 100_000_000) {
      return response.status(400).json({ error: 'Monthly fee must be a whole number between 1 and 100,000,000 BDT' })
    }
    if (!isFeeMonth(startsMonth)) return response.status(400).json({ error: 'Provide a valid start month in YYYY-MM format' })
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) return response.status(400).json({ error: 'Fee due day must be between 1 and 28' })
    const { centerId } = request.coachingMembership
    const student = await CoachingStudent.exists({ _id: studentId, centerId, status: 'active' })
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })
    const previousPlan = await CoachingFeePlan.findOne({ centerId, studentId, startsMonth }).select('monthlyAmount startsMonth dueDay').lean()
    const plan = await CoachingFeePlan.findOneAndUpdate(
      { centerId, studentId, startsMonth },
      { $set: { monthlyAmount, startsMonth, dueDay, updatedBy: request.firebaseUser.uid } },
      { new: true, upsert: true, runValidators: true },
    ).populate({ path: 'studentId', select: 'name studentCode' })
    await CoachingAuditEvent.create({
      centerId,
      actorId: request.firebaseUser.uid,
      action: 'fee-plan.updated',
      entityType: 'fee-plan',
      entityId: String(plan._id),
      details: {
        studentId: String(studentId),
        before: previousPlan ? {
          monthlyAmount: previousPlan.monthlyAmount,
          startsMonth: previousPlan.startsMonth,
          dueDay: previousPlan.dueDay,
        } : null,
        after: { monthlyAmount, startsMonth, dueDay },
      },
    })
    response.json(serialize(plan.toObject()))
  } catch (error) {
    next(error)
  }
})

router.patch('/centers/:centerId/fees/:feeId/void', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { feeId } = request.params
    const reason = normalizeRequiredString(request.body?.reason, 'Void reason', 300)
    if (!mongoose.isValidObjectId(feeId)) return response.status(400).json({ error: 'Invalid fee receipt' })
    const { centerId } = request.coachingMembership
    const record = await CoachingFeeRecord.findOneAndUpdate(
      { _id: feeId, centerId, status: 'active' },
      { $set: { status: 'voided', voidedAt: new Date(), voidedBy: request.firebaseUser.uid, voidReason: reason } },
      { new: true, runValidators: true },
    )
    if (!record) return response.status(404).json({ error: 'Active fee receipt not found in this center' })
    await CoachingAuditEvent.create({
      centerId,
      actorId: request.firebaseUser.uid,
      action: 'fee-receipt.voided',
      entityType: 'fee-receipt',
      entityId: String(record._id),
      details: { amount: record.amount, studentId: String(record.studentId), reason },
    })
    response.json(serialize(record.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Void reason')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.post('/centers/:centerId/fees', requireCenterMembership, requireCenterRoles(...managementRoles, 'accountant'), async (request, response, next) => {
  try {
    const { studentId, feeMonth, amount, paymentDate, category, method, reference, note } = request.body ?? {}
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    if (!isFeeMonth(feeMonth)) return response.status(400).json({ error: 'Provide a valid fee month in YYYY-MM format' })
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100_000_000) {
      return response.status(400).json({ error: 'Fee amount must be a whole number between 1 and 100,000,000 BDT' })
    }
    if (!isCalendarDate(paymentDate)) return response.status(400).json({ error: 'Provide a valid payment date in YYYY-MM-DD format' })
    if (!['tuition', 'admission', 'exam', 'other'].includes(category)) {
      return response.status(400).json({ error: 'Choose a valid fee category' })
    }
    if (!['cash', 'bank', 'mobile_banking', 'other'].includes(method)) {
      return response.status(400).json({ error: 'Choose a valid payment method' })
    }
    const { centerId } = request.coachingMembership
    const student = await CoachingStudent.exists({ _id: studentId, centerId, status: 'active' })
    if (!student) return response.status(404).json({ error: 'Active student profile not found in this center' })
    const record = await CoachingFeeRecord.create({
      centerId,
      studentId,
      feeMonth,
      amount,
      paymentDate,
      category,
      method,
      reference: typeof reference === 'string' ? reference.trim().slice(0, 80) : '',
      note: typeof note === 'string' ? note.trim().slice(0, 300) : '',
      recordedBy: request.firebaseUser.uid,
    })
    const populatedRecord = await CoachingFeeRecord.findById(record._id)
      .populate({ path: 'studentId', select: 'name studentCode' })
      .lean()
    response.status(201).json(serialize(populatedRecord))
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/attendance/report', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { from, to, batchId } = request.query
    if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) {
      return response.status(400).json({ error: 'Choose a valid date range in YYYY-MM-DD format' })
    }
    const rangeLength = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
    if (rangeLength > 92) return response.status(400).json({ error: 'Attendance reports can cover up to 93 days at a time' })
    if (batchId && !mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    const { centerId } = request.coachingMembership
    const permittedBatchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    if (request.coachingMembership.role === 'teacher') {
      if (batchId && !permittedBatchIds.some((id) => String(id) === String(batchId))) {
        return response.status(403).json({ error: 'Teachers can only report on their assigned batches' })
      }
    }
    const scopedBatchIds = batchId
      ? [batchId]
      : permittedBatchIds
        ? permittedBatchIds.map(String)
        : null
    const today = dhakaDateValue()
    const reportEnd = to > today ? today : to
    const sessions = await CoachingClassSession.find({
      centerId,
      date: { $gte: from, $lte: reportEnd },
      status: 'scheduled',
      ...(scopedBatchIds ? { batchId: { $in: scopedBatchIds } } : {}),
    })
      .populate({ path: 'batchId', select: 'name subject' })
      .sort({ date: -1, startTime: -1 })
      .limit(1000)
      .lean()
    const sessionBatchIds = [...new Set(sessions.map((session) => String(session.batchId?._id ?? session.batchId)))]
    const enrollments = sessionBatchIds.length
      ? await CoachingEnrollment.find({ centerId, batchId: { $in: sessionBatchIds }, status: 'active' })
          .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode guardianName guardianPhone guardianWhatsAppOptIn' })
          .populate({ path: 'batchId', select: 'name subject' })
          .lean()
      : []
    const attendance = sessions.length
      ? await CoachingAttendance.find({
          centerId,
          date: { $in: sessions.map((session) => session.date) },
          batchId: { $in: sessionBatchIds },
        }).select('studentId batchId date status').lean()
      : []
    const attendanceBySessionStudent = new Map(attendance.map((record) => [
      `${record.date}:${record.batchId}:${record.studentId}`,
      record.status,
    ]))
    const enrollmentsByBatch = new Map()
    for (const enrollment of enrollments) {
      if (!enrollment.studentId || !enrollment.batchId) continue
      const key = String(enrollment.batchId._id)
      const batchEnrollments = enrollmentsByBatch.get(key) ?? []
      batchEnrollments.push(enrollment)
      enrollmentsByBatch.set(key, batchEnrollments)
    }
    const grouped = new Map()
    for (const session of sessions) {
      const sessionBatchId = String(session.batchId?._id ?? session.batchId)
      for (const enrollment of enrollmentsByBatch.get(sessionBatchId) ?? []) {
        const studentId = String(enrollment.studentId._id)
        const key = `${sessionBatchId}:${studentId}`
        if (!grouped.has(key)) {
          grouped.set(key, {
            student: serialize(enrollment.studentId),
            batch: serialize(session.batchId),
            counts: { present: 0, absent: 0, late: 0, excused: 0 },
            consecutiveAbsences: 0,
            records: [],
          })
        }
        const row = grouped.get(key)
        const status = attendanceBySessionStudent.get(`${session.date}:${sessionBatchId}:${studentId}`) ?? ''
        if (status) row.counts[status] += 1
        row.records.push({ date: session.date, startTime: session.startTime, status })
      }
    }
    const rows = [...grouped.values()]
    for (const row of rows) {
      for (const record of row.records) {
        if (record.status !== 'absent') break
        row.consecutiveAbsences += 1
      }
      if (request.coachingMembership.role === 'teacher') {
        delete row.student.guardianName
        delete row.student.guardianPhone
        delete row.student.guardianWhatsAppOptIn
      }
    }
    response.json({
      from,
      to,
      rows,
      sessions: sessions.length,
      totals: rows.reduce((totals, row) => {
        for (const [status, count] of Object.entries(row.counts)) totals[status] += count
        return totals
      }, { present: 0, absent: 0, late: 0, excused: 0 }),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/schedule', requireCenterMembership, async (request, response, next) => {
  try {
    const { from, to } = request.query
    if (!isCalendarDate(from) || !isCalendarDate(to) || from > to) {
      return response.status(400).json({ error: 'Choose a valid schedule date range in YYYY-MM-DD format' })
    }
    const { centerId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const sessions = await CoachingClassSession.find({
      centerId,
      date: { $gte: from, $lte: to },
      ...(batchIds ? { batchId: { $in: batchIds } } : {}),
    })
      .populate({ path: 'batchId', select: 'name subject grade teacherId', populate: { path: 'teacherId', select: 'name' } })
      .sort({ date: 1, startTime: 1 })
      .limit(500)
      .lean()
    response.json({ sessions: sessions.map(serialize) })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/schedule', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId, title = '', date, startTime, endTime } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    if (!isCalendarDate(date)) return response.status(400).json({ error: 'Choose a valid class date' })
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
      return response.status(400).json({ error: 'Choose valid class times with end time after start time' })
    }
    if (typeof title !== 'string' || title.trim().length > 120) return response.status(400).json({ error: 'Class topic cannot exceed 120 characters' })
    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only schedule their assigned batches' })
    }
    if (await hasClassScheduleConflict({ centerId, batch, date, startTime, endTime })) {
      return response.status(409).json({ error: 'This batch or assigned teacher already has a class during that time' })
    }
    const session = await CoachingClassSession.create({
      centerId,
      batchId,
      title: title.trim(),
      date,
      startTime,
      endTime,
      createdBy: request.firebaseUser.uid,
      history: [{ action: 'scheduled', changedBy: request.firebaseUser.uid }],
    })
    const populatedSession = await CoachingClassSession.findById(session._id)
      .populate({ path: 'batchId', select: 'name subject grade teacherId', populate: { path: 'teacherId', select: 'name' } })
      .lean()
    await CoachingAuditEvent.create({
      centerId,
      actorId: request.firebaseUser.uid,
      action: 'class-session.scheduled',
      entityType: 'class-session',
      entityId: String(session._id),
      details: { batchId: String(batchId), date, startTime, endTime },
    })
    response.status(201).json(serialize(populatedSession))
  } catch (error) {
    next(error)
  }
})

router.patch('/centers/:centerId/schedule/:sessionId', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { sessionId } = request.params
    if (!mongoose.isValidObjectId(sessionId)) return response.status(400).json({ error: 'Invalid class session' })
    const session = await CoachingClassSession.findOne({ _id: sessionId, centerId: request.coachingMembership.centerId })
    if (!session) return response.status(404).json({ error: 'Class session not found in this center' })
    const batch = await CoachingBatch.findOne({ _id: session.batchId, centerId: session.centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this class session' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, request.coachingMembership.userId, session.centerId)) {
      return response.status(403).json({ error: 'Teachers can only change sessions for their assigned batches' })
    }
    const { status, date, startTime, endTime, note } = request.body ?? {}
    if (status !== undefined && !['scheduled', 'cancelled'].includes(status)) {
      return response.status(400).json({ error: 'Class status must be scheduled or cancelled' })
    }
    if (date !== undefined && !isCalendarDate(date)) return response.status(400).json({ error: 'Choose a valid class date' })
    if (startTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return response.status(400).json({ error: 'Choose a valid start time' })
    if (endTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) return response.status(400).json({ error: 'Choose a valid end time' })
    const nextDate = date ?? session.date
    const nextStartTime = startTime ?? session.startTime
    const nextEndTime = endTime ?? session.endTime
    if (nextStartTime >= nextEndTime) return response.status(400).json({ error: 'Class end time must be after start time' })
    if (note !== undefined && (typeof note !== 'string' || note.trim().length > 300)) {
      return response.status(400).json({ error: 'Schedule note cannot exceed 300 characters' })
    }
    const nextStatus = status ?? session.status
    if (nextStatus === 'cancelled' && !note?.trim()) {
      return response.status(400).json({ error: 'Provide a cancellation reason' })
    }
    const changedSchedule = nextDate !== session.date
      || nextStartTime !== session.startTime
      || nextEndTime !== session.endTime
    const statusChanged = nextStatus !== session.status
    if (changedSchedule || statusChanged) {
      if (nextStatus === 'scheduled' && await hasClassScheduleConflict({
        centerId: session.centerId,
        batch,
        date: nextDate,
        startTime: nextStartTime,
        endTime: nextEndTime,
        excludeSessionId: session._id,
      })) {
        return response.status(409).json({ error: 'This batch or assigned teacher already has a class during that time' })
      }
      const previous = { date: session.date, startTime: session.startTime, endTime: session.endTime }
      session.date = nextDate
      session.startTime = nextStartTime
      session.endTime = nextEndTime
      session.status = nextStatus
      session.history.push({
        action: nextStatus === 'cancelled' ? 'cancelled' : 'rescheduled',
        fromDate: previous.date,
        fromStartTime: previous.startTime,
        fromEndTime: previous.endTime,
        note: note?.trim() ?? '',
        changedBy: request.firebaseUser.uid,
      })
      await session.save()
      await CoachingAuditEvent.create({
        centerId: session.centerId,
        actorId: request.firebaseUser.uid,
        action: nextStatus === 'cancelled' ? 'class-session.cancelled' : 'class-session.rescheduled',
        entityType: 'class-session',
        entityId: String(session._id),
        details: { before: previous, after: { date: nextDate, startTime: nextStartTime, endTime: nextEndTime }, note: note?.trim() ?? '' },
      })
    }
    const populatedSession = await CoachingClassSession.findById(session._id)
      .populate({ path: 'batchId', select: 'name subject grade teacherId', populate: { path: 'teacherId', select: 'name' } })
      .lean()
    response.json(serialize(populatedSession))
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/guardian-contacts', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { centerId } = request.coachingMembership
    const { studentId } = request.query
    if (studentId && !mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    const contacts = await CoachingGuardianContact.find({
      centerId,
      ...(studentId ? { studentId } : {}),
    })
      .populate({ path: 'studentId', select: 'name studentCode guardianName guardianPhone' })
      .sort({ contactedAt: -1 })
      .limit(200)
      .lean()
    response.json({ contacts: contacts.map(serialize) })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/guardian-contacts', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { studentId, method, reason, note } = request.body ?? {}
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    if (!['phone', 'in_person', 'other'].includes(method)) return response.status(400).json({ error: 'Choose a valid contact method' })
    if (!['fee_due', 'absence', 'academic', 'general'].includes(reason)) return response.status(400).json({ error: 'Choose a valid contact reason' })
    const normalizedNote = normalizeRequiredString(note, 'Contact note', 1000)
    const { centerId } = request.coachingMembership
    const student = await CoachingStudent.exists({ _id: studentId, centerId })
    if (!student) return response.status(404).json({ error: 'Student profile not found in this center' })
    const contact = await CoachingGuardianContact.create({
      centerId,
      studentId,
      method,
      reason,
      note: normalizedNote,
      contactedBy: request.firebaseUser.uid,
    })
    const populatedContact = await CoachingGuardianContact.findById(contact._id)
      .populate({ path: 'studentId', select: 'name studentCode guardianName guardianPhone' })
      .lean()
    response.status(201).json(serialize(populatedContact))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Contact note')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.get('/centers/:centerId/audit-events', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const events = await CoachingAuditEvent.find({ centerId: request.coachingMembership.centerId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    response.json({ events: events.map(serialize) })
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/whatsapp/status', requireCenterMembership, requireCenterRoles(...managementRoles), async (_request, response) => {
  response.json({
    provider: 'meta_cloud',
    configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    templates: {
      fee_due: Boolean(process.env.WHATSAPP_TEMPLATE_FEE_DUE),
      absence: Boolean(process.env.WHATSAPP_TEMPLATE_ABSENCE),
      schedule: Boolean(process.env.WHATSAPP_TEMPLATE_SCHEDULE),
    },
  })
})

router.get('/centers/:centerId/whatsapp/messages', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const messages = await CoachingWhatsAppMessage.find({ centerId: request.coachingMembership.centerId })
      .populate({ path: 'studentId', select: 'name studentCode' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    response.json({ messages: messages.map(serialize) })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/whatsapp/send-template', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  let messageRecord
  try {
    const { studentId, purpose, variables } = request.body ?? {}
    if (!mongoose.isValidObjectId(studentId)) return response.status(400).json({ error: 'Choose a valid student' })
    const templateEnvironmentKeys = {
      fee_due: 'WHATSAPP_TEMPLATE_FEE_DUE',
      absence: 'WHATSAPP_TEMPLATE_ABSENCE',
      schedule: 'WHATSAPP_TEMPLATE_SCHEDULE',
    }
    if (!Object.hasOwn(templateEnvironmentKeys, purpose)) return response.status(400).json({ error: 'Choose an available reminder purpose' })
    if (!Array.isArray(variables) || variables.length < 1 || variables.length > 5
      || variables.some((value) => typeof value !== 'string' || value.length > 200)) {
      return response.status(400).json({ error: 'Provide 1 to 5 short template parameters' })
    }
    const { centerId } = request.coachingMembership
    const student = await CoachingStudent.findOne({ _id: studentId, centerId, status: 'active' })
      .select('name guardianPhone guardianWhatsAppOptIn')
      .lean()
    if (!student) return response.status(404).json({ error: 'Active student not found in this center' })
    if (!student.guardianWhatsAppOptIn) return response.status(409).json({ error: 'Guardian WhatsApp opt-in is required before sending' })
    const recipientPhone = normalizeWhatsAppPhone(student.guardianPhone)
    if (!recipientPhone) return response.status(400).json({ error: 'Guardian phone must be a valid WhatsApp number' })
    const templateName = process.env[templateEnvironmentKeys[purpose]]
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'
    if (!templateName || !token || !phoneNumberId) {
      return response.status(503).json({ error: 'WhatsApp is not configured. Set the server environment variables and approved template before sending.' })
    }
    messageRecord = await CoachingWhatsAppMessage.create({
      centerId,
      studentId,
      recipientPhone,
      templateName,
      purpose,
      status: 'queued',
      sentBy: request.firebaseUser.uid,
    })
    let providerResponse
    try {
      providerResponse = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'bn' },
            components: [{
              type: 'body',
              parameters: variables.map((text) => ({ type: 'text', text })),
            }],
          },
        }),
      })
    } catch (providerError) {
      messageRecord.status = 'failed'
      messageRecord.error = providerError instanceof Error ? providerError.message.slice(0, 500) : 'WhatsApp provider request failed'
      await messageRecord.save()
      return response.status(502).json({ error: 'Could not connect to WhatsApp provider; the failed attempt was logged.' })
    }
    const result = await providerResponse.json().catch(() => null)
    if (!providerResponse.ok) {
      messageRecord.status = 'failed'
      messageRecord.error = result?.error?.message?.slice(0, 500) || `WhatsApp API returned HTTP ${providerResponse.status}`
      await messageRecord.save()
      return response.status(502).json({ error: `WhatsApp could not send this template: ${messageRecord.error}` })
    }
    messageRecord.status = 'sent'
    messageRecord.providerMessageId = result?.messages?.[0]?.id || ''
    await messageRecord.save()
    await CoachingAuditEvent.create({
      centerId,
      actorId: request.firebaseUser.uid,
      action: 'whatsapp.template-sent',
      entityType: 'whatsapp-message',
      entityId: String(messageRecord._id),
      details: { studentId: String(studentId), purpose, templateName },
    })
    response.status(201).json(serialize(messageRecord.toObject()))
  } catch (error) {
    if (messageRecord && messageRecord.status === 'queued') {
      messageRecord.status = 'failed'
      messageRecord.error = error instanceof Error ? error.message.slice(0, 500) : 'Message processing failed'
      await messageRecord.save()
    }
    next(error)
  }
})

router.get('/centers/:centerId/exams', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher', 'student'), async (request, response, next) => {
  try {
    const { centerId, role } = request.coachingMembership
    const requestedStatus = request.query.status ?? 'active'
    if (managementRoles.includes(role) && !['active', 'archived', 'all'].includes(requestedStatus)) {
      return response.status(400).json({ error: 'Exam status must be active, archived or all' })
    }
    const statusFilter = managementRoles.includes(role) && requestedStatus !== 'all'
      ? { status: requestedStatus }
      : { status: 'active' }
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const exams = await CoachingExam.find({
      centerId,
      ...statusFilter,
      ...(batchIds ? { batchId: { $in: batchIds } } : {}),
    })
      .populate({ path: 'batchId', select: 'name subject grade' })
      .sort({ examDate: -1, createdAt: -1 })
      .limit(200)
      .lean()
    response.json({
      truncated: exams.length === 200,
      exams: exams.map(serialize),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/exams', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { batchId, title, examDate, totalMarks } = request.body ?? {}
    if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch' })
    const normalizedTitle = normalizeRequiredString(title, 'Exam title', 120)
    if (!isCalendarDate(examDate)) return response.status(400).json({ error: 'Provide a valid exam date in YYYY-MM-DD format' })
    if (!Number.isSafeInteger(totalMarks) || totalMarks < 1 || totalMarks > 100_000) {
      return response.status(400).json({ error: 'Total marks must be a whole number between 1 and 100,000' })
    }
    const { centerId, userId } = request.coachingMembership
    const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only create exams for their assigned batches' })
    }
    const exam = await CoachingExam.create({
      centerId,
      batchId,
      title: normalizedTitle,
      examDate,
      totalMarks,
      createdBy: request.firebaseUser.uid,
    })
    response.status(201).json({ ...serialize(exam.toObject()), batch: serialize(batch), results: [] })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Exam title')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/exams/:examId', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { examId } = request.params
    if (!mongoose.isValidObjectId(examId)) return response.status(400).json({ error: 'Invalid exam' })
    const exam = await CoachingExam.findOne({ _id: examId, centerId: request.coachingMembership.centerId, status: 'active' })
    if (!exam) return response.status(404).json({ error: 'Active exam not found in this center' })
    const batch = await CoachingBatch.findOne({ _id: exam.batchId, centerId: exam.centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this exam' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, request.coachingMembership.userId, exam.centerId)) {
      return response.status(403).json({ error: 'Teachers can only edit exams for their assigned batches' })
    }
    const { title, examDate, totalMarks } = request.body ?? {}
    if (title !== undefined) exam.title = normalizeRequiredString(title, 'Exam title', 120)
    if (examDate !== undefined) {
      if (!isCalendarDate(examDate)) return response.status(400).json({ error: 'Provide a valid exam date in YYYY-MM-DD format' })
      exam.examDate = examDate
    }
    if (totalMarks !== undefined) {
      if (!Number.isSafeInteger(totalMarks) || totalMarks < 1 || totalMarks > 100_000) {
        return response.status(400).json({ error: 'Total marks must be a whole number between 1 and 100,000' })
      }
      const highestResult = await CoachingExamResult.findOne({ centerId: exam.centerId, examId })
        .sort({ marks: -1 })
        .select('marks')
        .lean()
      if (highestResult && highestResult.marks > totalMarks) {
        return response.status(409).json({ error: `Full marks cannot be lower than the highest recorded result (${highestResult.marks})` })
      }
      exam.totalMarks = totalMarks
    }
    await exam.save()
    await CoachingAuditEvent.create({
      centerId: exam.centerId,
      actorId: request.firebaseUser.uid,
      action: 'exam.updated',
      entityType: 'exam',
      entityId: String(exam._id),
      details: { title: exam.title, examDate: exam.examDate, totalMarks: exam.totalMarks },
    })
    response.json(serialize(exam.toObject()))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Exam title')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/exams/:examId/status', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    const { examId } = request.params
    const { status } = request.body ?? {}
    if (!mongoose.isValidObjectId(examId)) return response.status(400).json({ error: 'Invalid exam' })
    if (!['active', 'archived'].includes(status)) return response.status(400).json({ error: 'Exam status must be active or archived' })
    const exam = await CoachingExam.findOne({ _id: examId, centerId: request.coachingMembership.centerId })
    if (!exam) return response.status(404).json({ error: 'Exam not found in this center' })
    if (exam.status === status) return response.json(serialize(exam.toObject()))
    exam.status = status
    await exam.save()
    await CoachingAuditEvent.create({
      centerId: exam.centerId,
      actorId: request.firebaseUser.uid,
      action: status === 'archived' ? 'exam.archived' : 'exam.restored',
      entityType: 'exam',
      entityId: String(exam._id),
      details: { title: exam.title, status },
    })
    response.json(serialize(exam.toObject()))
  } catch (error) {
    next(error)
  }
})

router.get('/centers/:centerId/exams/:examId/results', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher', 'student'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.examId)) return response.status(400).json({ error: 'Invalid exam' })
    const { centerId, userId, role } = request.coachingMembership
    const exam = await CoachingExam.findOne({ _id: request.params.examId, centerId })
      .populate({ path: 'batchId', select: 'name subject grade' })
      .lean()
    if (!exam || (exam.status === 'archived' && !managementRoles.includes(role))) {
      return response.status(404).json({ error: 'Active exam not found in this center' })
    }
    const batch = await CoachingBatch.findOne({ _id: exam.batchId?._id ?? exam.batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this exam' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'This exam belongs to a batch you cannot access' })
    }

    if (role === 'student') {
      const studentIds = await getMemberStudentIds(centerId, userId)
      const enrolled = await CoachingEnrollment.exists({
        centerId,
        batchId: exam.batchId?._id ?? exam.batchId,
        studentId: { $in: studentIds },
        status: 'active',
      })
      if (!enrolled) return response.status(403).json({ error: 'This exam is not available for your enrolled batches' })
      const results = await CoachingExamResult.find({
        centerId,
        examId: exam._id,
        studentId: { $in: studentIds },
      })
        .populate({ path: 'studentId', select: 'name studentCode' })
        .lean()
      return response.json({ exam: serialize(exam), results: results.map(serialize) })
    }

    const enrollments = await CoachingEnrollment.find({
      centerId,
      batchId: exam.batchId?._id ?? exam.batchId,
      status: 'active',
    })
      .populate({ path: 'studentId', match: { status: 'active' }, select: 'name studentCode' })
      .lean()
    const students = enrollments.map((enrollment) => enrollment.studentId).filter(Boolean)
    const recordedResults = students.length
      ? await CoachingExamResult.find({
          centerId,
          examId: exam._id,
          studentId: { $in: students.map((student) => student._id) },
        }).lean()
      : []
    const resultsByStudent = new Map(recordedResults.map((result) => [String(result.studentId), result]))
    response.json({
      exam: serialize(exam),
      results: students.map((student) => {
        const result = resultsByStudent.get(String(student._id))
        return {
          id: result ? String(result._id) : '',
          studentId: String(student._id),
          studentName: student.name,
          studentCode: student.studentCode,
          marks: result?.marks ?? '',
          remarks: result?.remarks ?? '',
        }
      }),
    })
  } catch (error) {
    next(error)
  }
})

router.put('/centers/:centerId/exams/:examId/results', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { examId } = request.params
    const { entries } = request.body ?? {}
    if (!mongoose.isValidObjectId(examId)) return response.status(400).json({ error: 'Invalid exam' })
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) {
      return response.status(400).json({ error: 'Provide between 1 and 1,000 result entries' })
    }
    if (entries.some((entry) => (
      !entry
      || !mongoose.isValidObjectId(entry.studentId)
      || !Number.isSafeInteger(entry.marks)
      || entry.marks < 0
      || typeof entry.remarks !== 'undefined' && typeof entry.remarks !== 'string'
    ))) {
      return response.status(400).json({ error: 'Each result needs a valid student, whole-number marks, and optional text remarks' })
    }
    if (entries.some((entry) => typeof entry.remarks === 'string' && entry.remarks.trim().length > 300)) {
      return response.status(400).json({ error: 'Result remarks cannot exceed 300 characters' })
    }
    const normalizedEntries = entries.map((entry) => ({
      studentId: String(entry.studentId).toLowerCase(),
      marks: entry.marks,
      remarks: typeof entry.remarks === 'string' ? entry.remarks.trim() : '',
    }))
    const studentIds = normalizedEntries.map((entry) => entry.studentId)
    if (new Set(studentIds).size !== studentIds.length) {
      return response.status(400).json({ error: 'A student can only appear once in a result submission' })
    }

    const { centerId, userId } = request.coachingMembership
    const exam = await CoachingExam.findOne({ _id: examId, centerId, status: 'active' }).lean()
    if (!exam) return response.status(404).json({ error: 'Active exam not found in this center' })
    if (normalizedEntries.some((entry) => entry.marks > exam.totalMarks)) {
      return response.status(400).json({ error: 'A student mark cannot exceed the exam total marks' })
    }
    const batch = await CoachingBatch.findOne({ _id: exam.batchId, centerId, status: 'active' }).lean()
    if (!batch) return response.status(404).json({ error: 'Active batch not found for this exam' })
    if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
      return response.status(403).json({ error: 'Teachers can only record results for their assigned batches' })
    }
    const [enrolledIds, activeStudentIds] = await Promise.all([
      CoachingEnrollment.find({
        centerId,
        batchId: exam.batchId,
        studentId: { $in: studentIds },
        status: 'active',
      }).distinct('studentId'),
      CoachingStudent.find({ centerId, _id: { $in: studentIds }, status: 'active' }).distinct('_id'),
    ])
    if (enrolledIds.length !== studentIds.length || activeStudentIds.length !== studentIds.length) {
      return response.status(400).json({ error: 'Results can only be recorded for active students enrolled in this exam batch' })
    }

    const previousResults = await CoachingExamResult.find({
      centerId,
      examId,
      studentId: { $in: studentIds },
    }).select('studentId marks remarks').lean()
    const previousByStudent = new Map(previousResults.map((result) => [String(result.studentId), result]))
    await CoachingExamResult.bulkWrite(normalizedEntries.map((entry) => ({
      updateOne: {
        filter: { centerId, examId, studentId: entry.studentId },
        update: {
          $set: {
            batchId: exam.batchId,
            marks: entry.marks,
            remarks: entry.remarks,
            recordedBy: request.firebaseUser.uid,
          },
        },
        upsert: true,
      },
    })))
    await CoachingAuditEvent.create({
      centerId,
      actorId: request.firebaseUser.uid,
      action: 'exam-results.saved',
      entityType: 'exam',
      entityId: String(exam._id),
      details: {
        title: exam.title,
        changes: normalizedEntries.map((entry) => ({
          studentId: entry.studentId,
          before: previousByStudent.has(entry.studentId)
            ? { marks: previousByStudent.get(entry.studentId).marks, remarks: previousByStudent.get(entry.studentId).remarks }
            : null,
          after: { marks: entry.marks, remarks: entry.remarks },
        })),
      },
    })
    response.json({ saved: normalizedEntries.length, examId })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Results changed at the same time; reload and try again' })
    next(error)
  }
})

router.get('/centers/:centerId/notices', requireCenterMembership, async (request, response, next) => {
  try {
    const { centerId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const today = new Date().toISOString().slice(0, 10)
    const notices = await CoachingNotice.find({
      centerId,
      status: 'active',
      $and: [
        { $or: [{ expiresAt: '' }, { expiresAt: { $gte: today } }] },
        batchIds
          ? { $or: [{ audience: 'all' }, { batchId: { $in: batchIds } }] }
          : {},
      ],
    })
      .populate({ path: 'batchId', select: 'name' })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()
    const readNotices = notices.length
      ? await CoachingNoticeRead.find({
          centerId,
          userId: request.firebaseUser.uid,
          noticeId: { $in: notices.map((notice) => notice._id) },
        }).distinct('noticeId')
      : []
    const readNoticeIds = new Set(readNotices.map(String))
    response.json({
      notices: notices.map((notice) => ({ ...serialize(notice), isRead: readNoticeIds.has(String(notice._id)) })),
      unreadCount: notices.filter((notice) => !readNoticeIds.has(String(notice._id))).length,
      truncated: notices.length === 200,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/centers/:centerId/notices/:noticeId/read', requireCenterMembership, async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noticeId)) return response.status(400).json({ error: 'Invalid notice' })
    const { centerId, userId } = request.coachingMembership
    const batchIds = await getMemberBatchIds(centerId, request.coachingMembership)
    const today = new Date().toISOString().slice(0, 10)
    const notice = await CoachingNotice.findOne({
      _id: request.params.noticeId,
      centerId,
      status: 'active',
      $and: [
        { $or: [{ expiresAt: '' }, { expiresAt: { $gte: today } }] },
        batchIds ? { $or: [{ audience: 'all' }, { batchId: { $in: batchIds } }] } : {},
      ],
    }).lean()
    if (!notice) return response.status(404).json({ error: 'Active notice not found for this coaching member' })
    const noticeRead = await CoachingNoticeRead.findOneAndUpdate(
      { centerId, noticeId: notice._id, userId },
      { $setOnInsert: { readAt: new Date() } },
      { new: true, upsert: true, runValidators: true },
    )
    response.json({ noticeId: String(notice._id), isRead: true, readAt: noticeRead.readAt })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'Notice read status changed; refresh the notice list' })
    next(error)
  }
})

router.post('/centers/:centerId/notices', requireCenterMembership, requireCenterRoles(...managementRoles, 'teacher'), async (request, response, next) => {
  try {
    const { title, message, audience = 'all', batchId, expiresAt = '' } = request.body ?? {}
    const normalizedTitle = normalizeRequiredString(title, 'Notice title', 120)
    const normalizedMessage = normalizeRequiredString(message, 'Notice message', 3000)
    if (!['all', 'batch'].includes(audience)) return response.status(400).json({ error: 'Choose a valid notice audience' })
    if (expiresAt && !isCalendarDate(expiresAt)) return response.status(400).json({ error: 'Provide a valid expiry date in YYYY-MM-DD format' })
    const { centerId, userId, role } = request.coachingMembership
    let targetBatchId = null
    if (audience === 'batch') {
      if (!mongoose.isValidObjectId(batchId)) return response.status(400).json({ error: 'Choose a valid batch for this notice' })
      const batch = await CoachingBatch.findOne({ _id: batchId, centerId, status: 'active' }).lean()
      if (!batch) return response.status(404).json({ error: 'Active batch not found in this center' })
      if (!await teacherCanAccessBatch(batch, request.coachingMembership, userId, centerId)) {
        return response.status(403).json({ error: 'Teachers can only send notices to their assigned batches' })
      }
      targetBatchId = batch._id
    } else if (role === 'teacher') {
      return response.status(403).json({ error: 'Teachers can only send notices to their assigned batches' })
    }
    const notice = await CoachingNotice.create({
      centerId,
      title: normalizedTitle,
      message: normalizedMessage,
      audience,
      batchId: targetBatchId,
      expiresAt,
      createdBy: userId,
      creatorName: request.firebaseUser.name ?? '',
    })
    const populatedNotice = await CoachingNotice.findById(notice._id)
      .populate({ path: 'batchId', select: 'name' })
      .lean()
    response.status(201).json(serialize(populatedNotice))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Notice title')) return response.status(400).json({ error: error.message })
    if (error instanceof Error && error.message.startsWith('Notice message')) return response.status(400).json({ error: error.message })
    next(error)
  }
})

router.patch('/centers/:centerId/notices/:noticeId', requireCenterMembership, requireCenterRoles(...managementRoles), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noticeId)) return response.status(400).json({ error: 'Invalid notice' })
    const { status } = request.body ?? {}
    if (!['active', 'archived'].includes(status)) return response.status(400).json({ error: 'Notice status must be active or archived' })
    const notice = await CoachingNotice.findOneAndUpdate(
      { _id: request.params.noticeId, centerId: request.params.centerId },
      { $set: { status } },
      { new: true, runValidators: true },
    )
      .populate({ path: 'batchId', select: 'name' })
      .lean()
    if (!notice) return response.status(404).json({ error: 'Notice not found in this center' })
    response.json(serialize(notice))
  } catch (error) {
    next(error)
  }
})

export default router
