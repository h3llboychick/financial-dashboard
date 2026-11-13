const WEEKDAY_RU = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const SLIDE_MS = 5200

export function money(value) {
  const rounded = Math.round(Number(value) || 0)
  // ru-RU groups thousands with a non-breaking space; keep one plain space so
  // the string is the same everywhere it is rendered
  return rounded.toLocaleString('ru-RU').replace(/[\u00A0\u202F,]/g, ' ') + ' €'
}

export function buildSlides(data) {
  if (!data?.has_data) {
    return [{
      id: 'empty',
      kicker: `${data?.year ?? ''}`,
      title: 'Пока нечего показать',
      body: 'За этот год нет записей в основной валюте. Добавь пару трат, и отчёт соберётся сам.',
    }]
  }

  const slides = []
  const top = data.categories[0]
  const weekdayMax = Math.max(...data.weekdays.map(day => day.amount), 1)

  slides.push({
    id: 'net',
    kicker: `${data.year} в цифрах`,
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `${data.totals.entries} записей, ${data.months_positive} месяцев из ${data.months.length} в плюсе`,
  })

  slides.push({
    id: 'flow',
    kicker: 'куда шли деньги',
    bars: [
      { label: 'заработал', value: data.totals.earned, color: 'from-emerald-400 to-emerald-700' },
      { label: 'потратил', value: data.totals.spent, color: 'from-red-400 to-red-700' },
      { label: 'отложил', value: data.totals.invested, color: 'from-blue-400 to-blue-700' },
    ],
    barMax: Math.max(data.totals.earned, data.totals.spent, data.totals.invested, 1),
  })

  if (top) {
    slides.push({
      id: 'category',
      kicker: 'главная статья',
      title: top.name,
      value: top.amount,
      body: `${top.share}% всех расходов года`,
      categories: data.categories.slice(0, 3),
      spendTotal: data.totals.spent,
    })
  }

  if (data.biggest_day) {
    slides.push({
      id: 'biggest-day',
      kicker: 'самый дорогой день',
      value: data.biggest_day.amount,
      body: `${data.biggest_day.date}, ${data.biggest_day.entries} записей` +
        (data.biggest_entry ? `. Крупнейшая: ${money(data.biggest_entry.amount)}, ${data.biggest_entry.category}` : ''),
    })
  }

  slides.push({
    id: 'no-spend',
    kicker: 'дни без трат',
    value: data.no_spend_days,
    raw: true,
    body: data.longest_no_spend_streak?.days
      ? `Самая длинная серия: ${data.longest_no_spend_streak.days} дней. Средний день трат ${money(data.spend_day_mean)}, медиана ${money(data.spend_day_median)}.`
      : `Средний день трат ${money(data.spend_day_mean)}, медиана ${money(data.spend_day_median)}.`,
    weekdays: [...data.weekdays]
      .sort((left, right) => ((left.index + 6) % 7) - ((right.index + 6) % 7))
      .map(day => ({ label: WEEKDAY_RU[(day.index + 6) % 7], ratio: day.amount / weekdayMax })),
  })

  slides.push({
    id: 'habits',
    kicker: 'подписки и переводы',
    value: data.subscriptions.monthly_amount,
    suffix: ' в месяц',
    body: `${data.subscriptions.active_rules} активных правил, ${data.transfers_count} переводов между кошельками.` +
      (data.logging.median_hour !== null ? ` Обычно записываешь около ${String(data.logging.median_hour).padStart(2, '0')}:00.` : ''),
  })

  slides.push({
    id: 'final',
    kicker: 'итог',
    value: data.totals.net,
    prefix: data.totals.net > 0 ? '+' : '',
    tone: data.totals.net >= 0 ? 'green' : 'red',
    body: `Заработано ${money(data.totals.earned)}, потрачено ${money(data.totals.spent)}, отложено ${money(data.totals.invested)}.`,
    final: true,
  })

  return slides
}


export { SLIDE_MS }
