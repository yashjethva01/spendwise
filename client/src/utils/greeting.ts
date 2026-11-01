export function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 21) return 'Good evening'
  return 'Good night'
}

export function getGreetingForDate(date: Date = new Date()): string {
  return getGreeting(date.getHours())
}
