'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { useEffect } from 'react'

// Add google to Window to avoid type errors
declare global {
  interface Window {
    google: any
  }
}

export function CustomGoogleOneTap() {
  const clerk = useClerk()
  const router = useRouter()
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const isProduction = process.env.NODE_ENV === 'production'

  // Only run in production and if Google Client ID is configured
  if (!isProduction || !googleClientId) {
    return null
  }

  useEffect(() => {
    // Will show the One Tap UI after two seconds
    const timeout = setTimeout(() => oneTap(), 2000)
    return () => {
      clearTimeout(timeout)
    }
  }, [])

  const oneTap = () => {
    const { google } = window
    if (google) {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: any) => {
          // Here we call our provider with the token provided by Google
          call(response.credential)
        },
      })

      // Display the One Tap UI, and log any errors that occur.
      return google.accounts.id.prompt((notification: any) => {
        console.log('Notification ::', notification)
        if (notification.isNotDisplayed()) {
          console.log('getNotDisplayedReason ::', notification.getNotDisplayedReason())
        } else if (notification.isSkippedMoment()) {
          console.log('getSkippedReason  ::', notification.getSkippedReason())
        } else if (notification.isDismissedMoment()) {
          console.log('getDismissedReason ::', notification.getDismissedReason())
        }
      })
    }
  }

  const call = async (token: string) => {
    try {
      const res = await clerk.authenticateWithGoogleOneTap({
        token,
      })

      await clerk.handleGoogleOneTapCallback(res, {
        signInFallbackRedirectUrl: '/',
      })
    } catch (error) {
      router.push('/')
    }
  }

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="beforeInteractive"
    />
  )
}
