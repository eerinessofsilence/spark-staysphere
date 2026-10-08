export const STAYSPHERE_URL = 'https://spark-staysphere.spark-staysphere-demo.workers.dev/'
export const DEMO_ADMIN_URL = `${STAYSPHERE_URL}admin/sign-in`
const configuredPmsUrl = import.meta.env.VITE_PMS_URL || 'http://localhost:3001/'
export const PMS_ONBOARDING_URL = new URL('admin/onboarding', configuredPmsUrl.endsWith('/') ? configuredPmsUrl : `${configuredPmsUrl}/`).toString()
export const BOOKING_URL =
  'https://spark-staysphere.spark-staysphere-demo.workers.dev/rooms?checkIn=2026-11-05&checkOut=2026-11-08&adults=2&children=0'
export const SPARK_URL = '/'
/** Used for the footer's plain contact link and to build the request-demo mailto in RequestDemoDialog. */
export const CONTACT_EMAIL = 'stay@asteriacove.example'
