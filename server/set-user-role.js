import process from 'node:process'
import { firebaseAdminAuth } from './firebaseAdmin.js'

const [email, role] = process.argv.slice(2)

if (!email || !['admin', 'user'].includes(role)) {
  console.error('Usage: npm run user:role -- <email> <admin|user>')
  process.exitCode = 1
} else {
  try {
    const user = await firebaseAdminAuth.getUserByEmail(email)
    await firebaseAdminAuth.setCustomUserClaims(user.uid, {
      ...user.customClaims,
      role,
    })
    await firebaseAdminAuth.revokeRefreshTokens(user.uid)
    console.log(`Set ${role} role for ${user.email}`)
  } catch (error) {
    console.error(`Could not set role: ${error.message}`)
    process.exitCode = 1
  }
}
