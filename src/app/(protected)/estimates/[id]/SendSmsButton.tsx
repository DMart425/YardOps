'use client'

import { logSmsSent } from './actions'

interface Props {
  phone: string
  smsBody: string
  estimateId: string
  customerId: string
}

export default function SendSmsButton({ phone, smsBody, estimateId, customerId }: Props) {
  function handleClick() {
    // Fire-and-forget log — don't block the SMS link opening
    logSmsSent(estimateId, customerId, smsBody).catch(() => {})
    window.location.href = 'sms:' + phone + '?body=' + encodeURIComponent(smsBody)
  }

  return (
    <button type="button" onClick={handleClick} className="btn btn-primary btn-full">
      Send via Text
    </button>
  )
}
