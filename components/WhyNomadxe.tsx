'use client';
import { motion } from 'framer-motion';
import styles from './WhyNomadxe.module.css';

export default function WhyNomadxe() {
  return (
    <section className={styles.section}>
      <div className={styles.bgImage} />
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className={styles.content}
        >
          <h2 className={styles.headline}>Built for Reality. Adapts to Your Setup.</h2>
          <p className={styles.bodyCopy}>
            Nomadxe focuses on outcomes, not limitations. Whether deploying a single unit for a quick response or scaling across multiple project sites, our platforms provide the flexibility required to maintain continuous remote visibility. We prioritize open architecture and consultative support, ensuring you retain ultimate control over your security strategy.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
