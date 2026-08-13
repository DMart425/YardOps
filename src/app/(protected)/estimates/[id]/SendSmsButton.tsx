'use client'

import { logSmsSent, markEstimateSent } from './actions'
import { launchSms } from '@/components/SmsLink'
import type { SmsMode } from '@/lib/sms'

interface Props {
  phone: string
  smsBody: string
  estimateId: string
  customerId: string
  currentStatus: string
  smsMode?: SmsMode
}

export default function SendSmsButton({ phone, smsBody, estimateId, customerId, currentStatus, smsMode = 'device' }: Props) {
  function handleClick() {
    logSmsSent(estimateId, customerId, smsBody).catch(() => {})
    if (currentStatus === 'draft') {
      markEstimateSent(estimateId).catch(() => {})
    }
    launchSms(phone, smsBody, smsMode)
  }

  return (
    <button type="button" onClick={handleClick} className="btn btn-primary btn-full">
      Send via Text
    </button>
  )
}
