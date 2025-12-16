"use client"

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { useT } from '@/lib/i18n/context'
import { apiFetch } from '@open-mercato/ui/backend/utils/api'
import { Calendar } from '@open-mercato/ui/primitives/calendar'
import { Button } from '@open-mercato/ui/primitives/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Slot = {
  start: string
  end: string
}

export default function PublicBookingPage() {
  const t = useT()
  const params = useParams()
  const router = useRouter()
  const serviceId = typeof params.serviceId === 'string' ? params.serviceId : ''

  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [slots, setSlots] = React.useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false)
  
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  // Load slots when date changes
  React.useEffect(() => {
    if (!serviceId || !date) return
    
    const fetchSlots = async () => {
      setIsLoadingSlots(true)
      setSlots([])
      setSelectedSlot(null)
      try {
        const from = startOfDay(date)
        const to = startOfDay(addDays(date, 1))
        const res = await apiFetch(`/api/booking/slots?serviceId=${serviceId}&from=${from.toISOString()}&to=${to.toISOString()}`)
        if (res.ok) {
            const data = await res.json()
            setSlots(data.items || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [serviceId, date])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !serviceId) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
        const res = await apiFetch('/api/booking/public/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceId,
                startsAt: selectedSlot.start,
                attendee: formData
            })
        })
        
        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || 'Failed to book')
        }
        
        setSuccess(true)
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
        setIsSubmitting(false)
    }
  }

  if (success) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-2xl text-primary">Booking Confirmed!</CardTitle>
                    <CardDescription>
                        Thank you, {formData.firstName}. Your booking has been received.
                    </CardDescription>
                </CardHeader>
                <CardFooter className="justify-center">
                    <Button onClick={() => window.location.reload()}>Book Another</Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_400px]">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Select a Date & Time</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6 md:flex-row">
                    <div className="rounded-md border p-2">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            className="rounded-md border"
                            disabled={(date) => date < startOfDay(new Date())}
                        />
                    </div>
                    <div className="flex-1">
                        <h3 className="mb-4 text-sm font-medium">Available Slots</h3>
                        {isLoadingSlots ? (
                            <div className="text-sm text-muted-foreground">Loading slots...</div>
                        ) : slots.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No slots available for this date.</div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {slots.map((slot) => (
                                    <Button
                                        key={slot.start}
                                        variant={selectedSlot === slot ? 'default' : 'outline'}
                                        className="w-full"
                                        onClick={() => setSelectedSlot(slot)}
                                    >
                                        {format(new Date(slot.start), 'HH:mm')}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Your Details</CardTitle>
                    <CardDescription>
                        {selectedSlot 
                            ? `Booking for ${format(new Date(selectedSlot.start), 'PPP p')}`
                            : 'Select a time slot to continue'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form id="booking-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input 
                                    id="firstName" 
                                    required 
                                    value={formData.firstName}
                                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input 
                                    id="lastName" 
                                    required 
                                    value={formData.lastName}
                                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input 
                                id="email" 
                                type="email" 
                                required 
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone (optional)</Label>
                            <Input 
                                id="phone" 
                                type="tel" 
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea 
                                id="notes" 
                                value={formData.notes}
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                            />
                        </div>
                        
                        {error && <div className="text-sm text-destructive">{error}</div>}
                    </form>
                </CardContent>
                <CardFooter>
                    <Button 
                        type="submit" 
                        form="booking-form" 
                        className="w-full" 
                        disabled={!selectedSlot || isSubmitting}
                    >
                        {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  )
}

