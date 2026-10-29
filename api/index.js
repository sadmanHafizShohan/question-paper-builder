import { app, connectDatabase } from '../server/index.js'

export default async function handler(request, response) {
  await connectDatabase()
  return app(request, response)
}
