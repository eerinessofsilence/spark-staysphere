export const STAYSPHERE_URL = new URL('/', import.meta.env.VITE_GUEST_URL || 'http://localhost:3100/').toString()
export const CMS_URL = new URL('/', import.meta.env.VITE_CMS_URL || 'http://localhost:3101/').toString()
export const DEMO_ADMIN_URL = new URL('/admin/sign-in', CMS_URL).toString()
export const BOOKING_URL = new URL('/rooms', STAYSPHERE_URL).toString()
export const SPARK_URL = '/'
export const CONTACT_EMAIL = 'stay@asteriacove.example'
