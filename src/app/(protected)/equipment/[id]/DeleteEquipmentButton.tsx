'use client'

import { useTransition } from 'react'
import { deleteEquipment } from '../actions'

interface Props {
  equipmentId: string
  equipmentName: string
}

export function DeleteEquipmentButton({ equipmentId, equipmentName }: Props) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    const confirmed = window.confirm(
      `Remove "${equipmentName}" and all its maintenance records? This cannot be undone.`
    )
    if (!confirmed) return
    startTransition(() => {
      deleteEquipment(equipmentId)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="btn btn-danger btn-sm"
    >
      {pending ? 'Removing…' : 'Remove Equipment'}
    </button>
  )
}
