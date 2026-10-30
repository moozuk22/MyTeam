import styles from './FinanceSkeleton.module.css';

export function SkeletonLine({ wide = false }: { wide?: boolean }) {
 return <span aria-hidden="true" className={`${styles.line} ${wide ? styles.wide : ''}`} />;
}

export function FinanceMetricSkeleton() {
 return <span className={styles.metric} role="status" aria-label="Зареждане" aria-busy="true"><SkeletonLine wide /></span>;
}

export default function FinanceSkeleton({ variant = 'history' }: { variant?: 'history' | 'analysis' | 'debts' | 'chart' | 'profile' | 'form' | 'categoryChips' | 'categories' }) {
 return <div className={`${styles.skeleton} ${styles[variant]}`} role="status" aria-label="Зареждане" aria-busy="true">
  <div aria-hidden="true">
   {variant === 'categoryChips' ? <div className={styles.chips}>{Array.from({length:10},(_,i) => <SkeletonLine key={i} wide />)}</div> : variant === 'categories' ? <div className={styles.categoryRows}>{Array.from({length:6},(_,i) => <div key={i} className={styles.categoryRow}><SkeletonLine /><SkeletonLine wide /><SkeletonLine /><SkeletonLine /></div>)}</div> : variant === 'chart' ? <div className={styles.chartLayout}><span className={styles.ring} /><div>{Array.from({length:4},(_,i) => <SkeletonLine key={i} wide />)}</div></div> : variant === 'profile' ? <><div className={styles.profileGrid}>{Array.from({length:10},(_,i) => <div key={i}><SkeletonLine /><SkeletonLine wide /></div>)}</div><div className={styles.field}><SkeletonLine wide /></div><div className={styles.field}><SkeletonLine wide /></div></> : variant === 'form' ? <>{Array.from({length:4},(_,i) => <div className={styles.field} key={i}><SkeletonLine /><SkeletonLine wide /></div>)}</> : <>
    <div className={styles.heading}><SkeletonLine /><SkeletonLine /></div>
    {Array.from({length:variant === 'analysis' ? 9 : 5},(_,i) => <div key={i} className={styles.row}>
     {variant === 'debts' && <span className={styles.avatar} />}
     {Array.from({length:variant === 'analysis' ? 6 : variant === 'debts' ? 2 : 4},(_,j) => <SkeletonLine key={j} wide />)}
    </div>)}
   </>}
  </div>
 </div>;
}
