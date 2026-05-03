'use client'

import { logSmsSent, updateEstimateStatus } from './actions'

interface Props {
  phone: string
  smsBody: string
  estimateId: string
  customerId: string
  currentStatus: string
}

export default function SendSmsButton({ phone, smsBody, estimateId, customerId, currentStatus }: Props) {
  function handleClick() {
    logSmsSent(estimateId, customerId, smsBody).catch(() => {})
    if (currentStatus === 'draft') {
      updateEstimateStatus(estimateId, 'pending').catch(() => {})
    }
    window.location.href = 'sms:' + phone + '?body=' + encodeURIComponent(smsBody)
  }

  return (
    <button type="button" onClick={handleClick} className="btn btn-primary btn-full">
      Send via Text
    </button>
  )
}
