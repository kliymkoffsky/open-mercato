"use client"

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { buttonVariants } from './button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={clsx('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4 sm:gap-6',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-2 flex items-center',
        nav_button: clsx(
          buttonVariants({ variant: 'outline' }),
          'size-7 p-0 opacity-70 hover:opacity-100',
        ),
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'w-9 text-muted-foreground rounded-md text-xs font-medium',
        row: 'flex w-full mt-2',
        cell: 'relative h-9 w-9 text-center text-sm p-0 focus-within:relative focus-within:z-20',
        day: clsx(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100',
        ),
        day_range_end: 'day-range-end',
        day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside: 'day-outside text-muted-foreground opacity-50',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'hidden',
        ...classNames,
      }}
      components={{
        IconLeft: (iconProps) => <ChevronLeft className="size-4" {...iconProps} />,
        IconRight: (iconProps) => <ChevronRight className="size-4" {...iconProps} />,
      }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'


