import styles from './StatCard.module.css';

export default function StatCard({ icon, label, value, color = '#2563eb', iconColor, iconBg, trend }) {
  const c = iconColor || color;
  const bg = iconBg || `${c}12`;
  return (
    <div className={styles.card}>
      <div className={styles.iconWrap} style={{ background: bg, color: c }}>
        {icon}
      </div>
      <div className={styles.info}>
        <p className={styles.label}>{label}</p>
        <h3 className={styles.value}>{value}</h3>
        {trend && (
          <span className={`${styles.trend} ${trend > 0 ? styles.up : styles.down}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  );
}
