export default function ActivityTimeline({ title = 'Activity', items = [], empty = 'No activity yet.' }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: '#434655' }}>{empty}</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.activity_id || item.decision_id} className="relative pl-5" style={{ borderLeft: '2px solid #E6E8EA' }}>
              <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full" style={{ background: '#0E7490' }} />
              <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{item.summary || item.action}</p>
              {(item.note || item.user_id || item.by) && (
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                  {[item.note, item.user_id || item.by].filter(Boolean).join(' • ')}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{item.created_at || item.at}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
