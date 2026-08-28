const TONE_STYLES = {
  attention: {
    icon: 'attention',
    iconClass: 'border border-amber-300 bg-transparent text-amber-600 dark:border-amber-700 dark:bg-transparent dark:text-amber-400',
    label: 'Needs attention',
  },
  positive: {
    icon: 'positive',
    iconClass: 'border border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300',
    label: 'Positive change',
  },
  neutral: {
    icon: 'neutral',
    iconClass: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
    label: 'Worth knowing',
  },
}

function StatusIcon({ type, className }) {
  return (
    <span className={`grid h-8 w-8 place-items-center rounded-lg ${className}`} aria-hidden="true">
      {type === 'attention' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v6" />
          <path d="M12 17h.01" />
        </svg>
      )}
      {type === 'positive' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12.5 4.25 4.25L19 7" />
        </svg>
      )}
      {type === 'neutral' && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6" />
          <path d="M12 7h.01" />
        </svg>
      )}
    </span>
  )
}

function percentage(value) {
  return `${Math.abs(value).toFixed(1)}%`
}

function pointChange(value) {
  if (value === null) return null
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} percentage points`
}

function spendingCard(spending, format) {
  if (!spending) return null
  if (spending.average === null || spending.monthsCompared === 0 || spending.percentChange === null) {
    return {
      id: 'spending',
      tone: spending.tone,
      title: `You spent ${format(spending.current)} this ${spending.period}`,
      description: 'There is not enough previous activity for a reliable spending trend yet.',
    }
  }

  const direction = spending.percentChange >= 0 ? 'above' : 'below'
  return {
    id: 'spending',
    tone: spending.tone,
    title: `Spending is ${percentage(spending.percentChange)} ${direction} your recent average`,
    description: `${format(spending.current)} this ${spending.period}, compared with ${format(spending.average)} across ${spending.monthsCompared} previous month${spending.monthsCompared === 1 ? '' : 's'}.`,
  }
}

function categoryCard(category, format) {
  if (!category) return null
  if (category.kind === 'spike') {
    return {
      id: 'category',
      tone: category.tone,
      title: `${category.name} is ${percentage(category.percentChange)} above normal`,
      description: `${format(category.current)} this month versus a ${format(category.average)} recent average; ${category.share.toFixed(1)}% of all spending.`,
    }
  }

  return {
    id: 'category',
    tone: category.tone,
    title: `${category.name} is your largest expense category`,
    description: `${format(category.current)} this month, representing ${category.share.toFixed(1)}% of all spending.`,
  }
}

function investmentCard(investment, format) {
  if (!investment) return null
  const change = pointChange(investment.percentagePointChange)
  return {
    id: 'investment',
    tone: investment.tone,
    title: `You invested ${investment.rate.toFixed(1)}% of your income`,
    description: change
      ? `${format(investment.invested)} invested from ${format(investment.income)} earned; ${change} versus last month.`
      : `${format(investment.invested)} invested from ${format(investment.income)} earned. Add another month to see the trend.`,
  }
}

export default function AnalyticsPanel({ analytics, format }) {
  const cards = [
    spendingCard(analytics.spending, format),
    categoryCard(analytics.category, format),
    investmentCard(analytics.investment, format),
  ].filter(Boolean)

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your financial brief</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Changes and patterns found in the selected month</p>
        </div>
        {cards.length > 0 && (
          <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            {cards.length} insight{cards.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-gray-300 dark:text-gray-600">
          No analytics for this month yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4">
          {cards.map(card => {
            const tone = TONE_STYLES[card.tone] || TONE_STYLES.neutral
            return (
              <article key={card.id} className="flex min-h-44 flex-col rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-700/30">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <StatusIcon type={tone.icon} className={tone.iconClass} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{tone.label}</span>
                </div>
                <h4 className="text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">{card.title}</h4>
                <p className="mt-1.5 text-xs leading-5 text-gray-500 dark:text-gray-400">{card.description}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
