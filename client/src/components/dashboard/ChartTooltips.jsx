export const CustomTooltip = ({ active, payload, label, format }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow text-sm">
      {label && <p className="text-gray-500 dark:text-gray-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-gray-900 dark:text-gray-100">
          <span style={{ color: p.color }}>{p.name}: </span>{format(p.value)}
        </p>
      ))}
    </div>
  )
}

export const PieTooltip = ({ active, payload, format }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow text-sm">
      <p className="text-gray-600 dark:text-gray-400">{name}</p>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{format(value)}</p>
    </div>
  )
}
